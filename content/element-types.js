export function getElementType(element) {
  const tagName = element.tagName.toLowerCase();
  switch (tagName) {
    case "p":
      return "Paragraph";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "Heading";
    case "li":
      return "List Item";
    case "a":
      return "Link";
    case "button":
      return "Button";
    case "input":
      return "Input Field";
    case "textarea":
      return "Text Area";
    case "select":
      return "Dropdown";
    case "img":
      return "Image";
    case "svg":
      return "SVG Graphic";
    case "canvas":
      return "Canvas (Chart)";
    case "table":
      return "Table";
    default:
      return "Element";
  }
}
