interface Node {
  type: string
  value?: string
  children?: Node[]
}

interface Citation {
  id: number
  text: string
  count: number
}

const CITE_RE = /\\cite\{([^{}]+)\}/g

export function remarkCitations() {
  return (tree: Node) => {
    const citations: Citation[] = []
    const citationsByText = new Map<string, Citation>()

    visitChildren(tree, (node) => {
      if (!node.children)
        return

      const nextChildren: Node[] = []
      let changed = false

      for (const child of node.children) {
        if (child.type !== 'text' || !child.value) {
          nextChildren.push(child)
          continue
        }

        const replacements = replaceCitations(child.value, citations, citationsByText)
        if (!replacements) {
          nextChildren.push(child)
          continue
        }

        changed = true
        nextChildren.push(...replacements)
      }

      if (changed)
        node.children = nextChildren
    })

    if (!tree.children || citations.length === 0)
      return

    tree.children.push({
      type: 'html',
      value: renderReferences(citations),
    })
  }
}

function visitChildren(node: Node, visitor: (node: Node) => void) {
  if (!node.children)
    return

  visitor(node)

  for (const child of node.children) {
    if (child.type === 'code' || child.type === 'inlineCode' || child.type === 'html')
      continue

    visitChildren(child, visitor)
  }
}

function replaceCitations(
  value: string,
  citations: Citation[],
  citationsByText: Map<string, Citation>,
) {
  const result: Node[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  CITE_RE.lastIndex = 0
  match = CITE_RE.exec(value)
  while (match) {
    const [raw, citationText] = match
    const textBefore = value.slice(lastIndex, match.index)
    if (textBefore)
      result.push({ type: 'text', value: textBefore })

    const citation = getCitation(citationText.trim(), citations, citationsByText)
    citation.count += 1
    result.push({
      type: 'html',
      value: renderCitation(citation),
    })
    lastIndex = match.index + raw.length
    match = CITE_RE.exec(value)
  }

  if (result.length === 0)
    return null

  const textAfter = value.slice(lastIndex)
  if (textAfter)
    result.push({ type: 'text', value: textAfter })

  return result
}

function getCitation(
  text: string,
  citations: Citation[],
  citationsByText: Map<string, Citation>,
) {
  const existing = citationsByText.get(text)
  if (existing)
    return existing

  const citation = {
    id: citations.length + 1,
    text,
    count: 0,
  }
  citations.push(citation)
  citationsByText.set(text, citation)
  return citation
}

function renderCitation(citation: Citation) {
  const refId = `cite-ref-${citation.id}-${citation.count}`
  const firstRefId = `cite-ref-${citation.id}-1`
  const attrText = escapeAttribute(citation.text)

  return [
    `<sup id="${refId}" class="citation-ref">`,
    `<a href="#cite-${citation.id}" title="${attrText}" aria-label="引用 ${citation.id}: ${attrText}">`,
    `[${citation.id}]`,
    '</a>',
    refId === firstRefId ? '' : `<a class="citation-first-ref" href="#${firstRefId}" aria-label="跳到第一次引用 ${citation.id}"></a>`,
    '</sup>',
  ].join('')
}

function renderReferences(citations: Citation[]) {
  const items = citations
    .map((citation) => {
      const text = escapeHtml(citation.text)

      return [
        `<div id="cite-${citation.id}" class="reference-item" role="listitem">`,
        `<a class="reference-backref" href="#cite-ref-${citation.id}-1" title="回到第一次引用">`,
        `[${citation.id}]`,
        '</a>',
        ` ${text}`,
        '</div>',
      ].join('')
    })
    .join('')

  return `<section class="references" aria-label="References"><hr><div class="references-list" role="list">${items}</div></section>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}
