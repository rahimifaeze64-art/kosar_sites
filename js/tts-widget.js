/*!
 * tts-widget.js — دکمهٔ «شنیدن» برای سایت‌های ایستا (GitHub Pages)
 *
 * سرویس تبدیل متن به گفتار روی یک سرور جدا اجرا می‌شود (Hugging Face Space یا
 * سرور خودتان)؛ این اسکریپت فقط با آن حرف می‌زند. GitHub Pages نمی‌تواند خودِ
 * مدل را اجرا کند، چون ایستا است و مدل ۴۲۰ مگابایت وزن می‌خواهد.
 *
 * استفاده:
 *   <script src="js/tts-widget.js"></script>
 *   <script>
 *     FarsiTTS.init({
 *       apiBase: "https://username-my-tts-space.hf.space",
 *       voice: "my_voice",
 *     });
 *   </script>
 *
 *   <!-- متن داخل عنصر پیدا می‌شود و کنارش دکمه ساخته می‌شود -->
 *   <p data-tts>سلام، این متن خوانده می‌شود.</p>
 *
 *   <!-- یا متن دلخواه با data-tts="..." و صدای مخصوص با data-tts-voice -->
 *   <button data-tts="متن جایگزین" data-tts-voice="sample_male">خواندن</button>
 *
 * یا صریح:
 *   FarsiTTS.speak("سلام").then(audio => …)
 */
(function (global) {
  "use strict";

  var DEFAULTS = {
    apiBase: "",              // مثل https://user-space.hf.space — خالی = همین دامنه
    voice: "sample_female",
    selector: "[data-tts]",
    autoInject: true,
    label: "🔊 شنیدن",
    loadingLabel: "⏳",
    stopLabel: "⏹ توقف",
    buttonClass: "tts-speak-btn",
    cacheLimit: 40,
    timeoutMs: 180000,
    onError: null,
  };

  var config = Object.assign({}, DEFAULTS);
  var cache = new Map();      // key -> { url, seconds }
  var current = null;         // { audio, button, key }
  var pending = null;         // AbortController
  var voices = [];

  /* ---------------------------------------------------------------- helpers */

  function api(path) {
    return (config.apiBase || "").replace(/\/+$/, "") + path;
  }

  function textOf(element) {
    var explicit = element.getAttribute("data-tts");
    var raw = explicit && explicit.trim() ? explicit : element.textContent;
    return (raw || "").replace(/\s+/g, " ").trim();
  }

  function voiceOf(element) {
    return (element && element.getAttribute("data-tts-voice")) || config.voice;
  }

  function fail(error, element) {
    if (typeof config.onError === "function") config.onError(error, element);
    else console.error("[FarsiTTS]", error);
  }

  function cacheGet(key) {
    var hit = cache.get(key);
    if (!hit) return null;
    cache.delete(key);            // تازه‌سازی ترتیب LRU
    cache.set(key, hit);
    return hit;
  }

  function cachePut(key, value) {
    cache.set(key, value);
    while (cache.size > config.cacheLimit) {
      var oldestKey = cache.keys().next().value;
      var oldest = cache.get(oldestKey);
      cache.delete(oldestKey);
      if (oldest && oldest.url) URL.revokeObjectURL(oldest.url);
    }
  }

  /* --------------------------------------------------------------- playback */

  function stop() {
    if (current && current.audio) {
      try { current.audio.pause(); } catch (e) { /* noop */ }
      if (current.audio.src && current.audio.src.indexOf("blob:") === 0) {
        URL.revokeObjectURL(current.audio.src);
      }
    }
    if (current && current.button) setButton(current.button, "idle");
    current = null;
  }

  function setButton(button, mode) {
    if (!button) return;
    if (mode === "loading") {
      button.dataset.ttsState = "loading";
      button.disabled = true;
      if (!button.dataset.ttsLabel) button.dataset.ttsLabel = button.textContent;
      button.textContent = config.loadingLabel;
    } else if (mode === "playing") {
      button.dataset.ttsState = "playing";
      button.disabled = false;
      button.textContent = config.stopLabel;
    } else {
      button.dataset.ttsState = "idle";
      button.disabled = false;
      button.textContent = button.dataset.ttsLabel || config.label;
    }
  }

  function fetchAudio(text, voice) {
    var key = voice + "\u0000" + text;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve({ hit: hit, key: key, cached: true });

    if (pending) pending.abort();
    pending = new AbortController();
    var timer = setTimeout(function () { pending.abort(); }, config.timeoutMs);

    return fetch(api("/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, voice: voice, format: "wav" }),
      signal: pending.signal,
    }).then(function (response) {
      clearTimeout(timer);
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.detail || ("HTTP " + response.status));
        });
      }
      var seconds = parseFloat(response.headers.get("X-Audio-Seconds") || "0");
      return response.blob().then(function (blob) {
        var value = { url: URL.createObjectURL(blob), seconds: seconds };
        cachePut(key, value);
        return { hit: value, key: key, cached: false };
      });
    });
  }

  /**
   * متن را به گفتار تبدیل و پخش می‌کند.
   * @returns {Promise<{seconds:number, cached:boolean, audio:HTMLAudioElement}>}
   */
  function speak(text, options) {
    options = options || {};
    var voice = options.voice || config.voice;
    var button = options.button || null;
    var clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) return Promise.reject(new Error("empty text"));

    // کلیک دوباره روی همان دکمه = توقف
    if (current && current.button === button && button) {
      stop();
      return Promise.resolve({ seconds: 0, cached: false, stopped: true });
    }
    stop();
    setButton(button, "loading");

    return fetchAudio(clean, voice).then(function (result) {
      var audio = new Audio(result.hit.url);
      current = { audio: audio, button: button, key: result.key };
      setButton(button, "playing");
      audio.onended = stop;
      audio.onerror = function () { fail(new Error("playback failed"), button); stop(); };
      return audio.play().then(function () {
        return { seconds: result.hit.seconds, cached: result.cached, audio: audio };
      });
    }).catch(function (error) {
      setButton(button, "idle");
      fail(error, button);
      throw error;
    });
  }

  function warm(text, options) {
    options = options || {};
    return fetchAudio((text || "").trim(), options.voice || config.voice)
      .then(function () { return true; });
  }

  /* ------------------------------------------------------------- auto-inject */

  function attach(element) {
    if (element.dataset.ttsBound === "1") return;
    element.dataset.ttsBound = "1";

    var button = document.createElement("button");
    button.type = "button";
    button.className = config.buttonClass;
    button.textContent = config.label;
    if (element.dataset.ttsButtonStyle) button.setAttribute("style", element.dataset.ttsButtonStyle);

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      speak(textOf(element), { button: button, voice: voiceOf(element) }).catch(function () {});
    });

    // اگر خودِ عنصر یک دکمه است، متنش دکمه را خراب می‌کند → بچسبان کنارش
    if (element.tagName === "BUTTON" || element.dataset.ttsInline === "false") {
      element.insertAdjacentElement("afterend", button);
    } else {
      element.appendChild(button);
    }
  }

  function inject(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll(config.selector);
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
    return nodes.length;
  }

  /* ------------------------------------------------------------------- setup */

  function refreshVoices() {
    return fetch(api("/api/voices"))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        voices = (data.voices || []).map(function (v) { return v.name; });
        return voices;
      })
      .catch(function (error) { fail(error, null); return voices; });
  }

  function init(options) {
    Object.assign(config, options || {});
    if (!config.apiBase && global.FARSI_TTS_API_BASE) config.apiBase = global.FARSI_TTS_API_BASE;
    if (config.apiBase === "" && /^https?:/.test(location.origin) === false) {
      /* noop: نسبت‌های نسبی مشکلی ندارند */
    }
    if (config.autoInject !== false) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { inject(document); });
      } else {
        inject(document);
      }
    }
    refreshVoices();
    return global.FarsiTTS;
  }

  // هر عنصری که بعداً به صفحه اضافه شود هم دکمه بگیرد
  if (global.MutationObserver) {
    var observer = new MutationObserver(function (records) {
      if (config.autoInject === false) return;
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType === 1) {
            if (node.matches && node.matches(config.selector)) attach(node);
            if (node.querySelectorAll) inject(node);
          }
        }
      }
    });
    document.addEventListener("DOMContentLoaded", function () {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  global.FarsiTTS = {
    init: init,
    speak: speak,
    warm: warm,
    stop: stop,
    inject: inject,
    refreshVoices: refreshVoices,
    getVoices: function () { return voices.slice(); },
    configure: function (options) { Object.assign(config, options || {}); return config; },
    clearCache: function () {
      cache.forEach(function (value) { URL.revokeObjectURL(value.url); });
      cache.clear();
    },
  };
})(window);
