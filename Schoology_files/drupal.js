// $Id: drupal.js,v 1.41.2.3 2008/06/25 09:06:57 goba Exp $

/**
 * Override jQuery.fn.init to guard against XSS attacks.
 * Pulled from https://github.com/d6lts/drupal/commit/cc19b4f724eb72d5cdf4e7999dd4154e385eb823
 * See http://bugs.jquery.com/ticket/9521
 */
(function () {
    var jquery_init = jQuery.fn.init;
    jQuery.fn.init = function (selector, context, rootjQuery) {
        // If the string contains a "#" before a "<", treat it as invalid HTML.
        if (selector && typeof selector === 'string') {
            var hash_position = selector.indexOf('#');
            if (hash_position >= 0) {
                var bracket_position = selector.indexOf('<');
                if (bracket_position > hash_position) {
                    throw 'Syntax error, unrecognized expression: ' + selector;
                }
            }
        }
        return jquery_init.call(this, selector, context, rootjQuery);
    };
    jQuery.fn.init.prototype = jquery_init.prototype;

    /**
     * Pre-filter Ajax requests to guard against XSS attacks.
     *
     * See https://github.com/jquery/jquery/issues/2432
     */
    if ($.ajaxPrefilter) {
        // For newer versions of jQuery, use an Ajax prefilter to prevent
        // auto-executing script tags from untrusted domains. This is similar to the
        // fix that is built in to jQuery 3.0 and higher.
        $.ajaxPrefilter(function (s) {
            if (s.crossDomain) {
                s.contents.script = false;
            }
        });
    }
    else if ($.httpData) {
        // For the version of jQuery that ships with Drupal core, override
        // jQuery.httpData to prevent auto-detecting "script" data types from
        // untrusted domains.
        var jquery_httpData = $.httpData;
        $.httpData = function (xhr, type, s) {
            // @todo Consider backporting code from newer jQuery versions to check for
            //   a cross-domain request here, rather than using Drupal.urlIsLocal() to
            //   block scripts from all URLs that are not on the same site.
            if (!type && !Drupal.urlIsLocal(s.url)) {
                var content_type = xhr.getResponseHeader('content-type') || '';
                if (content_type.indexOf('javascript') >= 0) {
                    // Default to a safe data type.
                    type = 'text';
                }
            }
            return jquery_httpData.call(this, xhr, type, s);
        };
        $.httpData.prototype = jquery_httpData.prototype;
    }
})();

var Drupal = Drupal || { 'settings': {}, 'behaviors': {}, 'themes': {}, 'locale': {} };

/**
 * Set the variable that indicates if JavaScript behaviors should be applied
 */
Drupal.jsEnabled = document.getElementsByTagName && document.createElement && document.createTextNode && document.documentElement && document.getElementById;

/**
 * Attach all registered behaviors to a page element.
 *
 * Behaviors are event-triggered actions that attach to page elements, enhancing
 * default non-Javascript UIs. Behaviors are registered in the Drupal.behaviors
 * object as follows:
 * @code
 *    Drupal.behaviors.behaviorName = function () {
 *      ...
 *    };
 * @endcode
 *
 * Drupal.attachBehaviors is added below to the jQuery ready event and so
 * runs on initial page load. Developers implementing AHAH/AJAX in their
 * solutions should also call this function after new page content has been
 * loaded, feeding in an element to be processed, in order to attach all
 * behaviors to the new content.
 *
 * Behaviors should use a class in the form behaviorName-processed to ensure
 * the behavior is attached only once to a given element. (Doing so enables
 * the reprocessing of given elements, which may be needed on occasion despite
 * the ability to limit behavior attachment to a particular element.)
 *
 * @param context
 *   An element to attach behaviors to. If none is given, the document element
 *   is used.
 */
Drupal.attachBehaviors = function(context) {
  context = context || document;
  if (Drupal.jsEnabled) {
    // Execute all of them.
    jQuery.each(Drupal.behaviors, function() {
      this(context);
    });
  }
};

/**
 * Encode special characters in a plain-text string for display as HTML.
 */
Drupal.checkPlain = function(str) {
  str = String(str);
  var replace = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
  for (var character in replace) {
    var regex = new RegExp(character, 'g');
    str = str.replace(regex, replace[character]);
  }
  return str;
};

/**
 * Translate strings to the page language or a given language.
 *
 * See the documentation of the server-side t() function for further details.
 *
 * @param str
 *   A string containing the English string to translate.
 * @param args
 *   An object of replacements pairs to make after translation. Incidences
 *   of any key in this array are replaced with the corresponding value.
 *   Based on the first character of the key, the value is escaped and/or themed:
 *    - !variable: inserted as is
 *    - @variable: escape plain text to HTML (Drupal.checkPlain)
 *    - %variable: escape text and theme as a placeholder for user-submitted
 *      content (checkPlain + Drupal.theme('placeholder'))
 * @return
 *   The translated string.
 */
Drupal.t = function(str, args) {
  // Fetch the localized version of the string.
  if (Drupal.locale.strings && Drupal.locale.strings[str]) {
    str = Drupal.locale.strings[str];
  }

  if (args) {
    // Transform arguments before inserting them
    for (var key in args) {
      switch (key.charAt(0)) {
        // Escaped only
        case '@':
          args[key] = Drupal.checkPlain(args[key]);
        break;
        // Pass-through
        case '!':
          break;
        // Escaped and placeholder
        case '%':
        default:
          args[key] = Drupal.theme('placeholder', args[key]);
          break;
      }
      str = str.replace(key, args[key]);
    }
  }
  return str;
};

Drupal.date_t = function(strParam, context) {

    var replace = Drupal.date_t_strings();
    switch (context) {
        case 'day_name':
        case 'day_abbr':
        case 'day_abbr1':
        case 'day_abbr2':
            untranslated = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            break;
        case 'month_name':
        case 'month_abbr':
            untranslated = {'1' : 'January', '2' : 'February', '3' : 'March', '4' : 'April', '5' : 'May', '6' : 'June', '7' : 'July', '8' : 'August', '9' : 'September', '10' : 'October', '11' : 'November', '12' : 'December'};
            break;
        case 'ampm':
            untranslated = ['am', 'pm', 'AM', 'PM'];
            break;
        case 'datetime':
            untranslated = ['Year', 'Month', 'Day', 'Week', 'Hour', 'Minute', 'Second', 'All Day', 'All day'];
            break;
        case 'datetime_plural':
            untranslated = ['Years', 'Months', 'Days', 'Weeks', 'Hours', 'Minutes', 'Seconds'];
            break;
        case 'date_order':
            untranslated = ['Every', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];
            break;
        case 'date_order_reverse':
            untranslated = ['', 'Last', 'Next to last', 'Third from last', 'Fourth from last', 'Fifth from last'];
            break;
        case 'date_nav':
            untranslated = ['Prev', 'Next', 'Today'];
            break;
    }

    pos = -1;
    $.each(untranslated, function(i, untranStr){
        if(untranStr == strParam){
            pos = i;
        }
    });
    return (pos > -1) ? replace[context][pos] : strParam;
}

Drupal.date_t_strings = function() {
    var replace = [];
    replace['day_name'] = $.trim(Drupal.t('!day-name Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday', {'!day-name' : ''})).split('|');
    replace['day_abbr'] = $.trim(Drupal.t('!day-abbreviation Sun|Mon|Tue|Wed|Thu|Fri|Sat', {'!day-abbreviation' : ''})).split('|');
    replace['day_abbr1'] = $.trim(Drupal.t('!day-abbreviation S|M|T|W|T|F|S', {'!day-abbreviation' : ''})).split('|');
    replace['day_abbr2'] = $.trim(Drupal.t('!day-abbreviation SU|MO|TU|WE|TH|FR|SA', {'!day-abbreviation' : ''})).split('|');
    replace['ampm'] = $.trim(Drupal.t('!ampm-abbreviation am|pm|AM|PM', {'!ampm-abbreviation' : ''})).split('|');
    replace['datetime'] = $.trim(Drupal.t('!datetime Year|Month|Day|Week|Hour|Minute|Second|All Day|All day', {'!datetime' : ''})).split('|');
    replace['datetime_plural'] = $.trim(Drupal.t('!datetime_plural Years|Months|Days|Weeks|Hours|Minutes|Seconds', {'!datetime_plural' : ''})).split('|');
    replace['date_order'] = $.trim(Drupal.t('!date_order Every|First|Second|Third|Fourth|Fifth', {'!date_order' : ''})).split('|');
    replace['date_order_reverse'] = $.trim(Drupal.t('!date_order |Last|Next to last|Third from last|Fourth from last|Fifth from last', {'!date_order' : ''})).split('|');
    replace['date_nav'] = $.trim(Drupal.t('!date_nav Prev|Next|Today', {'!date_nav' : ''})).split('|');

    // These start with a pipe so the January value will be in position 1 instead of position 0.
    replace['month_name'] = $.trim(Drupal.t('!month-name |January|February|March|April|May|June|July|August|September|October|November|December', {'!month-name' : ''})).split('|');
    replace['month_abbr'] = $.trim(Drupal.t('!month-abbreviation |Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec', {'!month-abbreviation' : ''})).split('|');

    return replace;
}

/**
 * Format a string containing a count of items.
 *
 * This function ensures that the string is pluralized correctly. Since Drupal.t() is
 * called by this function, make sure not to pass already-localized strings to it.
 *
 * See the documentation of the server-side format_plural() function for further details.
 *
 * @param count
 *   The item count to display.
 * @param singular
 *   The string for the singular case. Please make sure it is clear this is
 *   singular, to ease translation (e.g. use "1 new comment" instead of "1 new").
 *   Do not use @count in the singular string.
 * @param plural
 *   The string for the plural case. Please make sure it is clear this is plural,
 *   to ease translation. Use @count in place of the item count, as in "@count
 *   new comments".
 * @param args
 *   An object of replacements pairs to make after translation. Incidences
 *   of any key in this array are replaced with the corresponding value.
 *   Based on the first character of the key, the value is escaped and/or themed:
 *    - !variable: inserted as is
 *    - @variable: escape plain text to HTML (Drupal.checkPlain)
 *    - %variable: escape text and theme as a placeholder for user-submitted
 *      content (checkPlain + Drupal.theme('placeholder'))
 *   Note that you do not need to include @count in this array.
 *   This replacement is done automatically for the plural case.
 * @return
 *   A translated string.
 */
Drupal.formatPlural = function(count, singular, plural, args) {
  var args = args || {};
  args['@count'] = count;
  // Determine the index of the plural form.
  var index = Drupal.locale.pluralFormula ? Drupal.locale.pluralFormula(args['@count']) : ((args['@count'] == 1) ? 0 : 1);

  if (index == 0) {
    return Drupal.t(singular, args);
  }
  else if (index == 1) {
    return Drupal.t(plural, args);
  }
  else {
    args['@count['+ index +']'] = args['@count'];
    delete args['@count'];
    return Drupal.t(plural.replace('@count', '@count['+ index +']'));
  }
};

/**
 * Generate the themed representation of a Drupal object.
 *
 * All requests for themed output must go through this function. It examines
 * the request and routes it to the appropriate theme function. If the current
 * theme does not provide an override function, the generic theme function is
 * called.
 *
 * For example, to retrieve the HTML that is output by theme_placeholder(text),
 * call Drupal.theme('placeholder', text).
 *
 * @param func
 *   The name of the theme function to call.
 * @param ...
 *   Additional arguments to pass along to the theme function.
 * @return
 *   Any data the theme function returns. This could be a plain HTML string,
 *   but also a complex object.
 */
Drupal.theme = function(func) {
  for (var i = 1, args = []; i < arguments.length; i++) {
    args.push(arguments[i]);
  }

  return (Drupal.theme[func] || Drupal.theme.prototype[func]).apply(this, args);
};

/**
 * Parse a JSON response.
 *
 * The result is either the JSON object, or an object with 'status' 0 and 'data' an error message.
 */
Drupal.parseJson = function (data) {
  if ((data.substring(0, 1) != '{') && (data.substring(0, 1) != '[')) {
    return { status: 0, data: data.length ? data : Drupal.t('Unspecified error') };
  }
  return eval('(' + data + ');');
};

/**
 * Freeze the current body height (as minimum height). Used to prevent
 * unnecessary upwards scrolling when doing DOM manipulations.
 */
Drupal.freezeHeight = function () {
  Drupal.unfreezeHeight();
  var div = document.createElement('div');
  $(div).css({
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '1px',
    height: $('body').css('height')
  }).attr('id', 'freeze-height');
  $('body').append(div);
};

/**
 * Unfreeze the body height
 */
Drupal.unfreezeHeight = function () {
  $('#freeze-height').remove();
};

/**
 * Wrapper to address the mod_rewrite url encoding bug
 * (equivalent of drupal_urlencode() in PHP).
 */
Drupal.encodeURIComponent = function (item, uri) {
  uri = uri || location.href;
  item = encodeURIComponent(item).replace(/%2F/g, '/');
  return (uri.indexOf('?q=') != -1) ? item : item.replace(/%26/g, '%2526').replace(/%23/g, '%2523').replace(/\/\//g, '/%252F');
};

/**
 * Get the text selection in a textarea.
 */
Drupal.getSelection = function (element) {
  if (typeof(element.selectionStart) != 'number' && document.selection) {
    // The current selection
    var range1 = document.selection.createRange();
    var range2 = range1.duplicate();
    // Select all text.
    range2.moveToElementText(element);
    // Now move 'dummy' end point to end point of original range.
    range2.setEndPoint('EndToEnd', range1);
    // Now we can calculate start and end points.
    var start = range2.text.length - range1.text.length;
    var end = start + range1.text.length;
    return { 'start': start, 'end': end };
  }
  return { 'start': element.selectionStart, 'end': element.selectionEnd };
};

/**
 * Sanitizes a URL for use with jQuery.ajax().
 *
 * @param url
 * The URL string to be sanitized.
 *
 * @return
 * The sanitized URL.
 */
Drupal.sanitizeAjaxUrl = function (url) {
  var regex = /\=\?(&|$)/;
  while(url.match(regex)) {
    url = url.replace(regex, '');
  }
  return url;
}

/**
 * Build an error message from ahah response.
 */
Drupal.ahahError = function(xmlhttp, uri) {
  if (xmlhttp.status == 200) {
    if (jQuery.trim($(xmlhttp.responseText).text())) {
      var message = Drupal.t("An error occurred. \n@uri\n@text", {'@uri': uri, '@text': xmlhttp.responseText });
    }
    else {
      var message = Drupal.t("An error occurred. \n@uri\n(no information available).", {'@uri': uri, '@text': xmlhttp.responseText });
    }
  }
  else {
    var message = Drupal.t("An HTTP error @status occurred. \n@uri", {'@uri': uri, '@status': xmlhttp.status });
  }
  return message;
}

// Global Killswitch on the <html> element
if (Drupal.jsEnabled) {
  // Global Killswitch on the <html> element
  $(document.documentElement).addClass('js');
  // 'js enabled' cookie
  document.cookie = 'has_js=1; path=/';
  // Attach all behaviors.
  $(document).ready(function() {
    Drupal.attachBehaviors(this);
  });
}

/**
 * The default themes.
 */
Drupal.theme.prototype = {

  /**
   * Formats text for emphasized display in a placeholder inside a sentence.
   *
   * @param str
   *   The text to format (plain-text).
   * @return
   *   The formatted text (html).
   */
  placeholder: function(str) {
    return '<em>' + Drupal.checkPlain(str) + '</em>';
  }
};

Drupal.translations3_1 = {};

/**
 * Retrieves a translated string based on the provided key and optional arguments.
 *
 * This function looks up the translation for the given key from a global translations object.
 * If a translation is found, it replaces any placeholders in the translation with the values
 * provided in the `args` object. If no translation is found, the original key is returned.
 *
 * @param {string} sourceString - The key for the translation string.
 * @param {Object} [placeholders] - An object containing placeholder replacements.
 * @returns {string} The translated string with placeholders replaced, or the original key if no translation is found.
 */
Drupal.getTranslation = function(sourceString, placeholders) {
  var translated = Drupal.translations3_1[sourceString];

  if (translated) {
    // Replace variables in the translated string
    for (var v in placeholders) {
      translated = translated.replace("%{" + v + "}", placeholders[v]);
    }
    return translated;
  }

  return sourceString;
}
