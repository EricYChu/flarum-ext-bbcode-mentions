/*global getCaretCoordinates*/

import { extend } from 'flarum/extend';
import ComposerBody from 'flarum/components/ComposerBody';
import avatar from 'flarum/helpers/avatar';
import usernameHelper from 'flarum/helpers/username';
import highlight from 'flarum/helpers/highlight';
import KeyboardNavigatable from 'flarum/utils/KeyboardNavigatable';
import { truncate } from 'flarum/utils/string';

import AutocompleteDropdown from 'flarum/mentions/components/AutocompleteDropdown';

export default function addComposerAutocomplete() {
  extend(ComposerBody.prototype, 'config', function(original, isInitialized) {
    if (isInitialized) return;

    const composer = this;
    const $editorContainer = $('.sceditor-container');
    const iframe = $editorContainer.find('iframe')[0];
    const $iframe = $(iframe);
    const $container = $('<div class="ComposerBody-mentionsDropdownContainer"></div>');
    const dropdown = new AutocompleteDropdown({items: []});
    var $textarea = $(iframe.contentDocument.body);
    const searched = [];
    let mentionStart;
    let typed;
    let searchTimeout;
    let node;

    $(composer.element).append($container);

    const getCaretCharacterOffsetWithin = function getCaretCharacterOffsetWithin(element) {
      var caretOffset = 0;
      var doc = element.ownerDocument || element.document;
      var win = doc.defaultView || doc.parentWindow;
      var sel;
      if (typeof win.getSelection !== 'undefined') {
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
          var range = sel.getRangeAt(0);
          var preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(element);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          caretOffset = preCaretRange.toString().length;
        }
      } else if ( (sel = doc.selection) && sel.type != 'Control') {
        var textRange = sel.createRange();
        var preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint('EndToEnd', textRange);
        caretOffset = preCaretTextRange.text.length;
      }
      return caretOffset;
    };

    const setCaretCharacterOffsetWithin = function setCaretCharacterOffsetWithin(element, pos) {
      composer.editor.editor.focus();
      var doc = element.ownerDocument || element.document;
      var win = doc.defaultView || doc.parentWindow;
      var sel;
      if (typeof win.getSelection !== 'undefined') {
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
          var range = sel.getRangeAt(0);
          range.collapse(true);
          range.setStart(element, pos);
          sel.removeAllRanges();
          sel.addRange(range);
        } else if ( (sel = doc.selection) && sel.type != 'Control') {
          var textRange = sel.createRange();
          var preCaretTextRange = doc.body.createTextRange();
          preCaretTextRange.moveToElementText(element);
          preCaretTextRange.setEndPoint('StartToStart', textRange);
        }
      }
    };

    const applySuggestion = function(replacement) {
      const insert = replacement + ' ';

      node.nodeValue = node.nodeValue.substring(0, mentionStart - 1) + insert + node.nodeValue.substr(getCaretCharacterOffsetWithin(node));

      var index = mentionStart - 1 + insert.length;
      setCaretCharacterOffsetWithin(node, index);

      dropdown.hide();
    };

    this.navigator = new KeyboardNavigatable();
    this.navigator
      .when(() => dropdown.active)
      .onUp(() => dropdown.navigate(-1))
      .onDown(() => dropdown.navigate(1))
      .onSelect(dropdown.complete.bind(dropdown))
      .onCancel(dropdown.hide.bind(dropdown))
      .bindTo($textarea);

    composer.editor.editor
      .bind('keyup', function (e) {
        // Up, down, enter, tab, escape, left, right.
        if ([9, 13, 27, 40, 38, 37, 39].indexOf(e.which) !== -1) return;

        node = composer.editor.editor.currentNode();
        const cursor = getCaretCharacterOffsetWithin(node);

        // Search backwards from the cursor for an '@' symbol, without any
        // intervening whitespace. If we find one, we will want to show the
        // autocomplete dropdown!
        const value = node.nodeValue;
        if (value === null) return;
        mentionStart = 0;
        for (let i = cursor - 1; i >= 0; i--) {
          const character = value.substr(i, 1);
          if (/\s/.test(character)) break;
          if (character === '@') {
            if (i > 0 && !/\s/.test(value.substr(i - 1, 1))) break;
            mentionStart = i + 1;
            break;
          }
        }

        dropdown.hide();
        dropdown.active = false;

        if (mentionStart) {
          typed = value.substring(mentionStart, cursor).toLowerCase();

          const makeSuggestion = function(user, replacement, content, className = '') {
            const username = usernameHelper(user);
            if (typed) {
              username.children[0] = highlight(username.children[0], typed);
            }

            return (
              <button className={'PostPreview ' + className}
                onclick={() => applySuggestion(replacement)}
                onmouseenter={function() {
                  dropdown.setIndex($(this).parent().index());
                }}>
                <span className="PostPreview-content">
                  {avatar(user)}
                  {username} {' '}
                  {content}
                </span>
              </button>
            );
          };

          const buildSuggestions = () => {
            const suggestions = [];

            // If the user has started to type a username, then suggest users
            // matching that username.
            if (typed) {
              app.store.all('users').forEach(user => {
                if (user.username().toLowerCase().substr(0, typed.length) !== typed) return;

                suggestions.push(
                  makeSuggestion(user, '@' + user.username(), '', 'MentionsDropdown-user')
                );
              });
            }

            // If the user is replying to a discussion, or if they are editing a
            // post, then we can suggest other posts in the discussion to mention.
            // We will add the 5 most recent comments in the discussion which
            // match any username characters that have been typed.
            const composerPost = composer.props.post;
            const discussion = (composerPost && composerPost.discussion()) || composer.props.discussion;
            if (discussion) {
              discussion.posts()
                .filter(post => post && post.contentType() === 'comment' && (!composerPost || post.number() < composerPost.number()))
                .sort((a, b) => b.time() - a.time())
                .filter(post => {
                  const user = post.user();
                  return user && user.username().toLowerCase().substr(0, typed.length) === typed;
                })
                .splice(0, 5)
                .forEach(post => {
                  const user = post.user();
                  suggestions.push(
                    makeSuggestion(user, '@' + user.username() + '#' + post.id(), [
                      app.translator.trans('flarum-mentions.forum.composer.reply_to_post_text', {number: post.number()}), ' — ',
                      truncate(post.contentPlain(), 200)
                    ], 'MentionsDropdown-post')
                  );
                });
            }

            if (suggestions.length) {
              dropdown.props.items = suggestions;
              m.render($container[0], dropdown.render());

              dropdown.show();

              const coordinates = $textarea.caret('offset', {iframe: iframe});
              const offset1 = $editorContainer.position();
              const offset2 = $iframe.position();
              coordinates.left += offset1.left + offset2.left;
              coordinates.top += offset1.top + offset2.top;

              const width = dropdown.$().outerWidth();
              const height = dropdown.$().outerHeight();
              const parent = dropdown.$().offsetParent();
              let left = coordinates.left;
              let top = coordinates.top + 15;
              if (top + height > parent.height()) {
                top = coordinates.top - height - 15;
              }
              if (left + width > parent.width()) {
                left = parent.width() - width;
              }
              dropdown.show(left, top);
            }
          };

          buildSuggestions();

          dropdown.setIndex(0);
          dropdown.$().scrollTop(0);
          dropdown.active = true;

          clearTimeout(searchTimeout);
          if (typed) {
            searchTimeout = setTimeout(function() {
              const typedLower = typed.toLowerCase();
              if (searched.indexOf(typedLower) === -1) {
                app.store.find('users', {q: typed, page: {limit: 5}}).then(() => {
                  if (dropdown.active) buildSuggestions();
                });
                searched.push(typedLower);
              }
            }, 250);
          }
        }
      });
  });
}
