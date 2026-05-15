interface Node {
  type: string
  value?: string
  children?: Node[]
}

export function remarkMathDelimiters() {
  return (tree: Node) => {
    visitText(tree, (node) => {
      if (!node.value)
        return

      node.value = node.value
        .replaceAll('\\left{', '\\left\\{')
        .replaceAll('\\right}', '\\right\\}')
    })
  }
}

function visitText(node: Node, visitor: (node: Node) => void) {
  if (node.type === 'text') {
    visitor(node)
    return
  }

  if (!node.children || node.type === 'code' || node.type === 'inlineCode' || node.type === 'html')
    return

  for (const child of node.children) {
    visitText(child, visitor)
  }
}
