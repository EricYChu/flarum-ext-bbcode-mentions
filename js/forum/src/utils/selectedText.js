export default function selectedText(body) {
  const selection = window.getSelection();
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    const parent = range.commonAncestorContainer;
    if (body[0] === parent || $.contains(body[0], parent)) {
      const clone = $("<div>").append(range.cloneContents());

      // Replace emoji images with their shortcode (found in alt attribute)
      clone.find('img.emoji').replaceWith(function() {
        return this.alt;
      });

      // Replace all other images with a BBCode image
      clone.find('img').replaceWith(function() {
        return '[img src=' + this.src + ']';
      });

      // Replace all links with a BBCode link
      clone.find('a').replaceWith(function() {
        return '[url=' + this.href + ']' + this.innerText + '[/url]';
      });

      clone.find('ul').replaceWith(function() {
        return '[ul]' + this.innerText + '[/ul]';
      });

      clone.find('ol').replaceWith(function() {
        return '[ol]' + this.innerText + '[/ol]';
      });

      clone.find('li').replaceWith(function() {
        return '[li]' + this.innerText + '[/li]';
      });

      clone.find('td').replaceWith(function() {
        return '[td]' + this.innerText + '[/td]';
      });

      clone.find('th').replaceWith(function() {
        return '[th]' + this.innerText + '[/th]';
      });

      clone.find('tr').replaceWith(function() {
        return '[tr]' + this.innerText + '[/tr]';
      });

      clone.find('table').replaceWith(function() {
        return '[table]' + this.innerText + '[/table]';
      });

      clone.find('p').replaceWith(function() {
        return this.innerText + '\n';
      });

      clone.find('br').replaceWith(function() {
        return '\n';
      });

      return clone.text();
    }
  }
  return "";
}
