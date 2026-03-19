import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3",
    "strong", "em", "u", "s",
    "ul", "ol", "li",
    "a", "code", "pre",
    "blockquote", "hr",
    "span", "mark",
    "input"
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["style"],
    mark: ["data-color"],
    input: ["type", "checked", "disabled"],
    li: ["data-type", "data-checked"]
  },
  allowedStyles: {
    span: {
      color: [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/]
    }
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" })
  },
  allowedSchemes: ["http", "https", "mailto"]
};

export const sanitizeRichTextBody = (html: string): string =>
  sanitizeHtml(html, RICH_TEXT_OPTIONS);
