(function (root) {
  "use strict";

  var SMALL = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
  var SCALES = ["", "ribu", "juta", "miliar", "triliun", "kuadriliun", "kuintiliun"];
  var MAX_INTEGER_DIGITS = 21;

  function underThousand(value) {
    if (value === 0) return "";
    if (value < 10) return SMALL[value];
    if (value === 10) return "sepuluh";
    if (value === 11) return "sebelas";
    if (value < 20) return SMALL[value - 10] + " belas";
    if (value < 100) {
      var tens = Math.floor(value / 10);
      var remainder = value % 10;
      return SMALL[tens] + " puluh" + (remainder ? " " + SMALL[remainder] : "");
    }
    var hundreds = Math.floor(value / 100);
    var rest = value % 100;
    return (hundreds === 1 ? "seratus" : SMALL[hundreds] + " ratus") + (rest ? " " + underThousand(rest) : "");
  }

  function integerToWords(integer) {
    var value = integer.replace(/^0+(?=\d)/, "");
    if (value === "0") return "nol";
    if (value.length > MAX_INTEGER_DIGITS) {
      throw new RangeError("Angka maksimal 21 digit (hingga skala kuintiliun).");
    }

    var groups = [];
    for (var end = value.length; end > 0; end -= 3) {
      groups.push(Number(value.slice(Math.max(0, end - 3), end)));
    }
    var words = [];
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      if (!group) continue;
      var groupWords = i === 1 && group === 1 ? "seribu" : underThousand(group);
      if (i > 1) groupWords += " " + SCALES[i];
      else if (i === 1 && group !== 1) groupWords += " ribu";
      words.push(groupWords);
    }
    return words.join(" ");
  }

  function parseNumber(value) {
    var input = String(value).trim().replace(/^Rp\s*/i, "").replace(/\s/g, "");
    var match = /^(-?)([\d.]+)(?:,(\d*))?$/.exec(input);
    if (!match) throw new TypeError("Masukkan angka yang valid, gunakan koma untuk desimal.");
    if (match[2].indexOf(".") !== -1 && !/^\d{1,3}(?:\.\d{3})+$/.test(match[2])) {
      throw new TypeError("Pemisah ribuan harus menggunakan titik setiap tiga digit.");
    }
    var integer = match[2].replace(/\./g, "").replace(/^0+(?=\d)/, "");
    if (integer.length > MAX_INTEGER_DIGITS) {
      throw new RangeError("Angka maksimal 21 digit (hingga skala kuintiliun).");
    }
    return { negative: match[1] === "-", integer: integer, fraction: match[3] || "", hasDecimal: match[3] !== undefined };
  }

  function convert(value, options) {
    options = options || {};
    var mode = options.mode || "plain";
    var parsed = parseNumber(value);
    var integer = Number(parsed.integer);
    var words = integerToWords(parsed.integer);

    if (mode === "currency") {
      words += " rupiah";
      var cents = parsed.fraction.slice(0, 2).padEnd(2, "0");
      if (options.includeSen !== false && Number(cents) > 0) {
        words += " " + underThousand(Number(cents)) + " sen";
      }
    } else if (parsed.hasDecimal && parsed.fraction.length) {
      words += " koma " + parsed.fraction.split("").map(function (digit) {
        return digit === "0" ? "nol" : SMALL[Number(digit)];
      }).join(" ");
    }
    if (parsed.negative && (integer !== 0 || Number(parsed.fraction) !== 0)) words = "minus " + words;
    return words;
  }

  function capitalize(value, style) {
    if (style === "lower") return value.toLowerCase();
    if (style === "upper") return value.toUpperCase();
    if (style === "title") return value.replace(/\b[a-zà-öø-ÿ]/g, function (letter) { return letter.toUpperCase(); });
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function scaleForDigits(digits) {
    if (digits <= 1) return "Satuan";
    if (digits <= 2) return "Puluhan";
    if (digits <= 3) return "Ratusan";
    var group = Math.floor((digits - 1) / 3);
    return ["", "Ribuan", "Jutaan", "Miliaran", "Triliun", "Kuadriliun", "Kuintiliun"][group] || "Di luar jangkauan";
  }

  var api = {
    convert: convert,
    capitalize: capitalize,
    parseNumber: parseNumber,
    scaleForDigits: scaleForDigits,
    MAX_INTEGER_DIGITS: MAX_INTEGER_DIGITS
  };
  root.Terbilang = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
