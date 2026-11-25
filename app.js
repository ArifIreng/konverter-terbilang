(function () {
  "use strict";

  var api = window.Terbilang;
  var input = document.getElementById("number-input");
  var inputWrap = document.getElementById("input-wrap");
  var output = document.getElementById("result-output");
  var resultCard = document.getElementById("result-card");
  var mode = "plain";
  var toastTimer;
  var history = loadHistory();
  var HISTORY_KEY = "terbilang-history-v1";

  function loadHistory() {
    try {
      var saved = JSON.parse(localStorage.getItem("terbilang-history-v1") || "[]");
      return Array.isArray(saved) ? saved.slice(0, 6) : [];
    } catch (error) {
      showToast("Riwayat tidak dapat dibaca dari penyimpanan.", true);
      return [];
    }
  }

  function showToast(message, isError) {
    var toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.toggle("error-toast", Boolean(isError));
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("visible"); }, 2400);
  }

  function semanticCount(text) {
    return (text.match(/[0-9,-]/g) || []).length;
  }

  function caretAtSemanticCount(text, count) {
    if (count <= 0) return text.startsWith("Rp ") ? 3 : 0;
    var seen = 0;
    for (var i = 0; i < text.length; i++) {
      if (/[0-9,-]/.test(text.charAt(i)) && ++seen >= count) return i + 1;
    }
    return text.length;
  }

  function cleanRaw(value) {
    var text = value.replace(/^Rp\s*/i, "").replace(/\./g, "").replace(/[^\d,-]/g, "");
    var negative = text.charAt(0) === "-";
    text = text.replace(/-/g, "");
    if (negative) text = "-" + text;
    var comma = text.indexOf(",");
    if (comma !== -1) text = text.slice(0, comma + 1) + text.slice(comma + 1).replace(/,/g, "");
    if (mode === "currency" && comma !== -1) {
      text = text.slice(0, comma + 1) + text.slice(comma + 1, comma + 3);
    }
    return text;
  }

  function parsePastedNumericText(value) {
    var text = String(value).trim();
    var negative = /^\s*\(.*\)\s*$/.test(text);
    if (negative) text = text.replace(/^\s*\(|\)\s*$/g, "");

    var currencyPattern = /^\s*-?\s*(?:Rp(?:\.|\b)|IDR\b)/i;
    var hasCurrency = currencyPattern.test(text);
    text = text.replace(/^\s*-\s*(?=(?:Rp(?:\.|\b)|IDR\b))/i, "-");
    text = text.replace(/\bIDR\b|Rp\.?/gi, "").trim();
    text = text.replace(/(?:[,/]\s*-+|[/\\-]+)\s*$/, "");

    if (text.charAt(0) === "-") {
      negative = true;
      text = text.slice(1);
    }

    text = text.replace(/[^\d.,]/g, "");
    if (!/\d/.test(text)) return { value: "", hasCurrency: hasCurrency };

    var lastDot = text.lastIndexOf(".");
    var lastComma = text.lastIndexOf(",");
    var decimalSeparator = "";
    if (lastDot !== -1 && lastComma !== -1) {
      decimalSeparator = lastDot > lastComma ? "." : ",";
    } else if (lastDot !== -1 && !/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
      decimalSeparator = ".";
    } else if (lastComma !== -1 && !/^\d{1,3}(?:,\d{3})+$/.test(text)) {
      decimalSeparator = ",";
    }

    var integer;
    var fraction = "";
    if (decimalSeparator) {
      var separatorIndex = text.lastIndexOf(decimalSeparator);
      integer = text.slice(0, separatorIndex).replace(/[.,]/g, "");
      fraction = text.slice(separatorIndex + 1).replace(/[.,]/g, "");
    } else {
      integer = text.replace(/[.,]/g, "");
    }

    return {
      value: (negative ? "-" : "") + integer + (decimalSeparator ? "," + fraction : ""),
      hasCurrency: hasCurrency
    };
  }

  function formatRaw(raw) {
    if (!raw) return "";
    var negative = raw.charAt(0) === "-";
    var unsigned = negative ? raw.slice(1) : raw;
    var commaIndex = unsigned.indexOf(",");
    var integer = commaIndex === -1 ? unsigned : unsigned.slice(0, commaIndex);
    var fraction = commaIndex === -1 ? "" : unsigned.slice(commaIndex + 1);
    var formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var formatted = (negative ? "-" : "") + formattedInteger;
    if (commaIndex !== -1) formatted += "," + fraction;
    if (mode === "currency") formatted = "Rp " + formatted;
    return formatted;
  }

  function writeInput(raw, focusAtEnd) {
    var previous = input.value;
    var start = input.selectionStart || 0;
    var end = input.selectionEnd || start;
    var beforeStart = semanticCount(previous.slice(0, start));
    var beforeEnd = semanticCount(previous.slice(0, end));
    input.value = formatRaw(raw);
    if (!focusAtEnd && document.activeElement === input) {
      input.setSelectionRange(caretAtSemanticCount(input.value, beforeStart), caretAtSemanticCount(input.value, beforeEnd));
    } else if (focusAtEnd) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function applyCase(text) {
    return api.capitalize(text, document.getElementById("case-select").value);
  }

  function renderHistory() {
    var list = document.getElementById("history-list");
    var empty = document.getElementById("history-empty");
    var clear = document.getElementById("clear-history");
    list.replaceChildren();
    empty.hidden = history.length > 0;
    clear.hidden = history.length === 0;
    history.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.setAttribute("aria-label", "Gunakan kembali " + item.display);
      var value = document.createElement("div");
      value.className = "history-value";
      value.textContent = item.display;
      var words = document.createElement("div");
      words.className = "history-text";
      words.textContent = applyCase(item.words);
      button.append(value, words);
      button.addEventListener("click", function () {
        setMode(item.mode, false);
        writeInput(item.raw, true);
        update(true);
      });
      list.appendChild(button);
    });
  }

  function saveHistory(raw, words) {
    if (!raw || !/\d/.test(raw)) return;
    var display = formatRaw(raw);
    history = [{ raw: raw, mode: mode, words: words, display: display }].concat(history.filter(function (item) {
      return item.raw !== raw || item.mode !== mode;
    })).slice(0, 6);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
    } catch (error) {
      showToast("Riwayat tidak dapat disimpan di perangkat ini.", true);
    }
  }

  function update(shouldSave) {
    var raw = cleanRaw(input.value);
    if (input.value !== formatRaw(raw)) writeInput(raw, false);
    var unsigned = raw.replace(/^-/, "");
    var integerPart = unsigned.split(",")[0] || "";
    var significantDigits = integerPart.replace(/^0+(?=\d)/, "").length;
    var digitCount = document.getElementById("digit-count");
    var scale = document.getElementById("scale-label");
    var clearButton = document.getElementById("clear-input");
    var status = document.getElementById("result-status");
    digitCount.textContent = significantDigits + " digit";
    scale.textContent = "Skala: " + (significantDigits ? api.scaleForDigits(significantDigits) : "—");
    clearButton.hidden = !raw;

    if (!/\d/.test(raw)) {
      output.textContent = "Angka Anda akan menjadi kata-kata di sini.";
      output.className = "result-output empty";
      status.textContent = "MENUNGGU INPUT";
      status.classList.remove("ready");
      document.getElementById("copy-button").disabled = true;
      document.getElementById("speak-button").disabled = true;
      document.getElementById("result-subtitle").textContent = "Teks akan muncul di sini";
      renderHistory();
      return;
    }

    try {
      var words = api.convert(raw, { mode: mode, includeSen: document.getElementById("sen-toggle").checked });
      var rendered = applyCase(words);
      output.textContent = rendered;
      output.className = "result-output";
      status.textContent = "SIAP DISALIN";
      status.classList.add("ready");
      document.getElementById("copy-button").disabled = false;
      document.getElementById("speak-button").disabled = false;
      document.getElementById("result-subtitle").textContent = "Hasil konversi Bahasa Indonesia";
      if (shouldSave) saveHistory(raw, words);
      else renderHistory();
    } catch (error) {
      output.textContent = error.message;
      output.className = "result-output error";
      status.textContent = "PERIKSA INPUT";
      status.classList.remove("ready");
      document.getElementById("copy-button").disabled = true;
      document.getElementById("speak-button").disabled = true;
      document.getElementById("result-subtitle").textContent = "Angka di luar batas atau format tidak valid";
    }
  }

  function setMode(nextMode, highlight, addDefaultCents) {
    if (mode === nextMode) return;
    mode = nextMode;
    document.getElementById("plain-mode").classList.toggle("active", mode === "plain");
    document.getElementById("currency-mode").classList.toggle("active", mode === "currency");
    document.getElementById("plain-mode").setAttribute("aria-pressed", String(mode === "plain"));
    document.getElementById("currency-mode").setAttribute("aria-pressed", String(mode === "currency"));
    inputWrap.classList.toggle("currency", mode === "currency");
    document.getElementById("sen-toggle-wrap").classList.toggle("visible", mode === "currency");
    var raw = cleanRaw(input.value);
    if (mode === "currency" && raw && addDefaultCents !== false) {
      var commaIndex = raw.indexOf(",");
      if (commaIndex === -1) raw += ",00";
      else raw = raw.slice(0, commaIndex + 1) + raw.slice(commaIndex + 1).padEnd(2, "0").slice(0, 2);
    }
    writeInput(raw, false);
    if (highlight !== false) {
      resultCard.classList.remove("highlight");
      void resultCard.offsetWidth;
      resultCard.classList.add("highlight");
      window.setTimeout(function () { resultCard.classList.remove("highlight"); }, 800);
    }
  }

  function readPreset(button) {
    setMode(button.dataset.mode, true);
    var raw = button.dataset.value + (button.dataset.decimal ? "," + button.dataset.decimal : "");
    writeInput(raw, true);
    update(true);
  }

  input.addEventListener("input", function () {
    var raw = cleanRaw(input.value);
    if (mode === "currency" && raw.indexOf(",") !== -1) {
      var parts = raw.split(",");
      raw = parts[0] + "," + parts[1].slice(0, 2);
    }
    writeInput(raw, false);
    update(true);
  });
  input.addEventListener("paste", function (event) {
    var pasted = event.clipboardData && event.clipboardData.getData("text/plain");
    if (!pasted) return;
    event.preventDefault();

    var parsed = parsePastedNumericText(pasted);
    if (!parsed.value) {
      showToast("Teks yang ditempel tidak mengandung angka.", true);
      return;
    }

    var previousRaw = cleanRaw(input.value);
    var start = semanticCount(input.value.slice(0, input.selectionStart || 0));
    var end = semanticCount(input.value.slice(0, input.selectionEnd || input.selectionStart || 0));
    var shouldSwitchToCurrency = parsed.hasCurrency && mode === "plain";
    if (shouldSwitchToCurrency) setMode("currency", true, false);

    var raw = previousRaw.slice(0, start) + parsed.value + previousRaw.slice(end);
    if (mode === "currency" && raw && raw.indexOf(",") === -1) raw += ",00";
    writeInput(raw, false);
    var caret = caretAtSemanticCount(input.value, start + semanticCount(parsed.value));
    input.setSelectionRange(caret, caret);
    update(true);

    if (shouldSwitchToCurrency) showToast("Mode Mata Uang (Rp) diaktifkan dari teks tempelan.");
  });
  document.getElementById("plain-mode").addEventListener("click", function () { setMode("plain", true); update(true); });
  document.getElementById("currency-mode").addEventListener("click", function () { setMode("currency", true); update(true); });
  document.getElementById("case-select").addEventListener("change", function () { update(false); });
  document.getElementById("sen-toggle").addEventListener("change", function () { update(true); });
  document.querySelectorAll(".preset-chip").forEach(function (button) { button.addEventListener("click", function () { readPreset(button); }); });
  document.getElementById("clear-input").addEventListener("click", function () {
    writeInput("", true);
    update(false);
  });
  document.getElementById("clear-history").addEventListener("click", function () {
    history = [];
    try {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
      showToast("Riwayat berhasil dihapus.");
    } catch (error) {
      showToast("Riwayat tidak dapat dihapus.", true);
    }
  });
  document.getElementById("copy-button").addEventListener("click", function () {
    var text = output.textContent;
    function copied() { showToast("Teks terbilang berhasil disalin."); }
    function fallbackCopy() {
      var helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.className = "visually-hidden";
      document.body.appendChild(helper);
      helper.select();
      var successful = false;
      try {
        successful = document.execCommand("copy");
      } catch (error) {
        successful = false;
      } finally {
        helper.remove();
      }
      if (successful) copied();
      else showToast("Gagal menyalin teks. Periksa izin clipboard browser.", true);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(copied).catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  });
  document.getElementById("speak-button").addEventListener("click", function () {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      showToast("Fitur pelafalan tidak didukung browser ini.", true);
      return;
    }
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(output.textContent);
    utterance.lang = "id-ID";
    window.speechSynthesis.speak(utterance);
  });
  document.getElementById("theme-toggle").addEventListener("click", function () {
    var dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    this.setAttribute("aria-label", dark ? "Aktifkan tema terang" : "Aktifkan tema gelap");
    try { localStorage.setItem("terbilang-theme", dark ? "dark" : "light"); }
    catch (error) { showToast("Preferensi tema tidak dapat disimpan.", true); }
  });
  try {
    var savedTheme = localStorage.getItem("terbilang-theme");
    if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";
  } catch (error) {
    showToast("Preferensi tema tidak dapat dibaca.", true);
  }
  renderHistory();
  update(false);
}());
