import { type Node, parse } from "node-html-parser";

const REMOVABLE_SELECTOR = "video, img, script, style";
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

function removeSiblingsFrom(node: Node, includeSelf: boolean): void {
  const parent = node.parentNode;
  if (!parent) return;
  const siblings = parent.childNodes;
  const index = siblings.indexOf(node);
  const from = includeSelf ? index : index + 1;
  for (let i = siblings.length - 1; i >= from; i--) {
    siblings[i].remove();
  }
}

function truncateFromNodeOnward(node: Node): void {
  removeSiblingsFrom(node, true);
  let ancestor = node.parentNode;
  while (ancestor?.parentNode) {
    removeSiblingsFrom(ancestor, false);
    ancestor = ancestor.parentNode;
  }
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export default function htmlToBareDescription(html: string): string {
  const root = parse(html);

  root.querySelectorAll(REMOVABLE_SELECTOR).forEach((element) => {
    element.remove();
  });

  const heading = root.querySelector(HEADING_SELECTOR);
  if (heading) {
    truncateFromNodeOnward(heading);
  }

  return collapseWhitespace(root.text);
}
