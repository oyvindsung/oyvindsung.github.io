interface Node {
  type: string
  value?: string
  alt?: string | null
  children?: Node[]
}

interface Figure {
  id: string
  label: string
  number: number
}

const FIG_RE = /\\fig\{([^{}]+)\}/g
const FIG_CAPTION_RE = /^\\fig\{([\s\S]+)\}$/

export function remarkCaptions() {
  return (tree: Node) => {
    if (!tree.children)
      return

    const referencedLabels = collectReferencedLabels(tree)
    const figuresByLabel = new Map<string, Figure>()
    const usedIds = new Map<string, number>()
    const nextChildren: Node[] = []

    let figureNumber = 0
    let index = 0

    while (index < tree.children.length) {
      const child = tree.children[index]
      const image = getSingleImage(child)
      const caption = getFigureCaption(tree.children[index + 1])
      const imageLabel = image?.alt?.trim()
      const label = imageLabel || caption
      const shouldNumberFigure = Boolean(image && label && (caption || referencedLabels.has(label)))

      if (!image || !label || !shouldNumberFigure) {
        nextChildren.push(child)
        index += 1
        continue
      }

      figureNumber += 1

      const figure = {
        id: createUniqueId(label, usedIds),
        label,
        number: figureNumber,
      }
      figuresByLabel.set(label, figure)

      nextChildren.push(
        {
          type: 'html',
          value: `<figure id="${figure.id}" class="captioned-figure">`,
        },
        child,
        {
          type: 'html',
          value: renderFigcaption(figure, caption || label),
        },
        {
          type: 'html',
          value: '</figure>',
        },
      )

      index += caption ? 2 : 1
    }

    tree.children = nextChildren
    replaceFigureRefs(tree, figuresByLabel)
  }
}

function collectReferencedLabels(tree: Node) {
  const labels = new Set<string>()

  visitChildren(tree, (node) => {
    if (node.type !== 'text' || !node.value)
      return

    let match: RegExpExecArray | null

    FIG_RE.lastIndex = 0
    match = FIG_RE.exec(node.value)
    while (match) {
      labels.add(match[1].trim())
      match = FIG_RE.exec(node.value)
    }
  })

  return labels
}

function replaceFigureRefs(tree: Node, figuresByLabel: Map<string, Figure>) {
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

      const replacements = replaceFigureRefsInText(child.value, figuresByLabel)
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
}

function replaceFigureRefsInText(value: string, figuresByLabel: Map<string, Figure>) {
  const result: Node[] = []
  let lastIndex = 0
  let changed = false
  let match: RegExpExecArray | null

  FIG_RE.lastIndex = 0
  match = FIG_RE.exec(value)
  while (match) {
    const [raw, rawLabel] = match
    const label = rawLabel.trim()
    const figure = figuresByLabel.get(label)

    if (!figure) {
      match = FIG_RE.exec(value)
      continue
    }

    const textBefore = value.slice(lastIndex, match.index)
    if (textBefore)
      result.push({ type: 'text', value: textBefore })

    result.push({
      type: 'html',
      value: renderFigureRef(figure),
    })
    lastIndex = match.index + raw.length
    changed = true
    match = FIG_RE.exec(value)
  }

  if (!changed)
    return null

  const textAfter = value.slice(lastIndex)
  if (textAfter)
    result.push({ type: 'text', value: textAfter })

  return result
}

function getSingleImage(node?: Node) {
  if (!node || node.type !== 'paragraph' || !node.children)
    return null

  if (node.children.length !== 1)
    return null

  const [child] = node.children
  if (child.type !== 'image')
    return null

  return child
}

function getFigureCaption(node?: Node) {
  if (!node || node.type !== 'paragraph')
    return null

  const text = getPlainText(node).trim()
  const match = FIG_CAPTION_RE.exec(text)

  return match?.[1].trim() || null
}

function getPlainText(node: Node): string {
  if (node.type === 'text')
    return node.value || ''

  if (node.type === 'break')
    return '\n'

  return node.children?.map(getPlainText).join('') || ''
}

function visitChildren(node: Node, visitor: (node: Node) => void) {
  visitor(node)

  if (!node.children)
    return

  for (const child of node.children) {
    if (child.type === 'code' || child.type === 'inlineCode' || child.type === 'html')
      continue

    visitChildren(child, visitor)
  }
}

function createUniqueId(label: string, usedIds: Map<string, number>) {
  const base = `fig-${slugify(label)}`
  const count = usedIds.get(base) || 0

  usedIds.set(base, count + 1)

  if (count === 0)
    return base

  return `${base}-${count + 1}`
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'image'
}

function renderFigureRef(figure: Figure) {
  const label = escapeAttribute(figure.label)

  return `<a class="figure-ref" href="#${figure.id}" title="图 ${figure.number}: ${label}" aria-label="图 ${figure.number}: ${label}">${figure.number}</a>`
}

function renderFigcaption(figure: Figure, caption: string) {
  return `<figcaption><span class="caption-label">Fig. ${figure.number}.</span> ${escapeHtml(caption)}</figcaption>`
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
