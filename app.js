(() => {
  "use strict";

  const WORDS_PER_DAY = 10;
  const ANCHOR_DATE = "2026-01-01";
  const STORAGE_KEY = "cet6-daily-words-v1";
  const THEME_KEY = "cet6-daily-words-theme";
  const RING_LENGTH = 326.73;

  const elements = {
    streakCount: document.getElementById("streakCount"),
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon"),
    todayLabel: document.getElementById("todayLabel"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton"),
    progressCircle: document.getElementById("progressCircle"),
    progressPercent: document.getElementById("progressPercent"),
    checkedCount: document.getElementById("checkedCount"),
    progressHint: document.getElementById("progressHint"),
    ringDescription: document.getElementById("ringDescription"),
    wordGrid: document.getElementById("wordGrid"),
    wordCardTemplate: document.getElementById("wordCardTemplate"),
    completionBanner: document.getElementById("completionBanner"),
    extraGrid: document.getElementById("extraGrid"),
    extraButtonTop: document.getElementById("extraButtonTop"),
    extraButton: document.getElementById("extraButton"),
    extraHint: document.getElementById("extraHint"),
    extraCompletionBanner: document.getElementById("extraCompletionBanner")
  };

  const words = Array.isArray(window.CET6_WORDS) ? window.CET6_WORDS : [];
  const todayKey = getDateKey(new Date());
  let appState = readState(todayKey);
  const checkedWords = new Set(appState.checked);
  const completedDates = new Set(appState.completedDates);
  const dailyWords = getDailyWords(todayKey, words, WORDS_PER_DAY);
  let extraWords = appState.extraWords.slice();
  const extraCheckedWords = new Set(appState.extraChecked);

  initTheme();
  renderToday();
  renderWords();
  renderExtraWords();
  updateProgress();
  bindEvents();

  function bindEvents() {
    elements.wordGrid.addEventListener("click", (event) => {
      handleCardClick(event, toggleWord);
    });

    elements.extraGrid.addEventListener("click", (event) => {
      handleCardClick(event, toggleExtraWord);
    });

    elements.extraButton.addEventListener("click", addExtraWords);
    elements.extraButtonTop.addEventListener("click", addExtraWords);

    elements.startButton.addEventListener("click", () => {
      const firstUnchecked = elements.wordGrid.querySelector(".word-card:not(.is-checked)");
      const target = firstUnchecked || document.getElementById("wordsSection");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (firstUnchecked) {
        window.setTimeout(() => firstUnchecked.querySelector(".check-button").focus(), 550);
      }
    });

    elements.resetButton.addEventListener("click", () => {
      if (checkedWords.size === 0) return;
      const shouldReset = window.confirm("确定要清除今天的所有勾选吗？");
      if (!shouldReset) return;

      checkedWords.clear();
      completedDates.delete(todayKey);
      saveState();
      elements.wordGrid.querySelectorAll(".word-card").forEach((card) => updateCardState(card, false));
      updateProgress();
    });

    elements.themeToggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      safeStorageSet(THEME_KEY, nextTheme);
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      window.location.reload();
    });
  }

  function handleCardClick(event, toggleHandler) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const card = actionButton.closest(".word-card");
    if (!card) return;

    if (actionButton.dataset.action === "toggle") {
      toggleHandler(card.dataset.word, card);
    }

    if (actionButton.dataset.action === "speak") {
      speakWord(card.dataset.word);
    }
  }

  function renderToday() {
    const formattedDate = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long"
    }).format(new Date());

    elements.todayLabel.textContent = `${formattedDate} · 今日学习`;
    elements.streakCount.textContent = String(getStreak(completedDates, todayKey));
  }

  function renderWords() {
    elements.wordGrid.replaceChildren();

    if (dailyWords.length === 0) {
      const message = document.createElement("p");
      message.textContent = "词库加载失败，请检查 data/words.js 是否存在。";
      elements.wordGrid.append(message);
      return;
    }

    const fragment = document.createDocumentFragment();

    dailyWords.forEach((word, index) => {
      const card = createWordCard(word, index);
      updateCardState(card, checkedWords.has(word.word));
      fragment.append(card);
    });

    elements.wordGrid.append(fragment);
  }

  function renderExtraWords() {
    elements.extraGrid.replaceChildren();

    if (extraWords.length === 0) return;

    const fragment = document.createDocumentFragment();

    extraWords.forEach((word, index) => {
      const card = createWordCard(word, index);
      updateCardState(card, extraCheckedWords.has(word.word));
      fragment.append(card);
    });

    elements.extraGrid.append(fragment);
  }

  function createWordCard(word, index) {
    const card = elements.wordCardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.word = word.word;
    card.querySelector(".word-index").textContent = String(index + 1).padStart(2, "0");
    card.querySelector(".word-title").textContent = word.word;
    card.querySelector(".word-phonetic").textContent = word.phonetic || "";

    const meaningList = card.querySelector(".meaning-list");
    word.meanings.forEach((meaning) => {
      const item = document.createElement("li");
      const part = document.createElement("span");
      const text = document.createElement("span");
      part.className = "meaning-pos";
      part.textContent = meaning.pos;
      text.textContent = meaning.text;
      item.append(part, text);
      meaningList.append(item);
    });

    const exampleList = card.querySelector(".example-list");
    word.examples.forEach((example) => {
      const item = document.createElement("li");
      const english = document.createElement("p");
      const chinese = document.createElement("p");
      english.className = "example-en";
      chinese.className = "example-zh";
      english.textContent = example.en;
      chinese.textContent = example.zh;
      item.append(english, chinese);
      exampleList.append(item);
    });

    const speakButton = card.querySelector(".speak-button");
    if (!("speechSynthesis" in window)) {
      speakButton.disabled = true;
      speakButton.title = "当前浏览器不支持朗读";
    }

    return card;
  }

  function toggleWord(word, card) {
    const isNowChecked = !checkedWords.has(word);

    if (isNowChecked) {
      checkedWords.add(word);
    } else {
      checkedWords.delete(word);
    }

    if (checkedWords.size === dailyWords.length) {
      completedDates.add(todayKey);
    } else {
      completedDates.delete(todayKey);
    }

    saveState();
    updateCardState(card, isNowChecked);
    updateProgress();
  }

  function toggleExtraWord(word, card) {
    const isNowChecked = !extraCheckedWords.has(word);

    if (isNowChecked) {
      extraCheckedWords.add(word);
    } else {
      extraCheckedWords.delete(word);
    }

    saveState();
    updateCardState(card, isNowChecked);
    updateProgress();
  }

  function addExtraWords() {
    const canAddMore = extraWords.length === 0 || extraCheckedWords.size === extraWords.length;
    if (!canAddMore) return;

    const batch = getNextExtraBatch();
    if (batch.length === 0) {
      updateExtraState();
      return;
    }

    extraWords.push(...batch);
    saveState();
    renderExtraWords();
    updateExtraState();

    window.setTimeout(() => {
      const firstCard = elements.extraGrid.querySelector(".word-card");
      if (firstCard) firstCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function getNextExtraBatch() {
    const excluded = new Set([
      ...dailyWords.map((word) => word.word),
      ...extraWords
    ]);
    const available = words.filter((word) => !excluded.has(word.word));
    if (available.length === 0) return [];

    const shuffled = seededShuffle(available, `cet6-extra-${todayKey}`);
    return shuffled.slice(0, Math.min(WORDS_PER_DAY, available.length));
  }

  function updateCardState(card, isChecked) {
    const word = card.dataset.word;
    const checkButton = card.querySelector(".check-button");
    const masterButton = card.querySelector(".master-button");

    card.classList.toggle("is-checked", isChecked);
    checkButton.setAttribute("aria-pressed", String(isChecked));
    checkButton.setAttribute("aria-label", isChecked ? `取消掌握 ${word}` : `标记 ${word} 为已掌握`);
    masterButton.textContent = isChecked ? "已掌握 · 点击取消" : "标记已掌握";
  }

  function updateProgress() {
    const count = checkedWords.size;
    const total = dailyWords.length || WORDS_PER_DAY;
    const percentage = total ? Math.round((count / total) * 100) : 0;
    const ringOffset = RING_LENGTH - (RING_LENGTH * percentage) / 100;

    elements.progressCircle.style.strokeDashoffset = String(ringOffset);
    elements.progressPercent.textContent = `${percentage}%`;
    elements.checkedCount.textContent = String(count);
    elements.ringDescription.textContent = `已掌握 ${count} 个，共 ${total} 个单词`;
    elements.streakCount.textContent = String(getStreak(completedDates, todayKey));

    if (count === 0) {
      elements.progressHint.textContent = "大约需要 8 分钟";
    } else if (count < total) {
      elements.progressHint.textContent = `还剩 ${total - count} 个单词`;
    } else {
      elements.progressHint.textContent = "今日目标已完成";
    }

    elements.completionBanner.hidden = count !== total;
    updateExtraState();
  }

  function updateExtraState() {
    const extraTotal = extraWords.length;
    const extraDone = extraCheckedWords.size;
    const extraComplete = extraTotal > 0 && extraDone === extraTotal;

    elements.extraCompletionBanner.hidden = !extraComplete;
    const extraButtons = [elements.extraButton, elements.extraButtonTop];
    extraButtons.forEach((button) => {
      button.disabled = extraTotal > 0 && !extraComplete;
    });

    if (extraTotal === 0) {
      elements.extraHint.textContent = "完成今日任务后，可以再提前背一组。每轮 10 个，从今天尚未出现的词库中挑选。";
      extraButtons.forEach((button) => {
        button.textContent = "提前背 10 个";
        button.title = "从剩余词库中提前学习 10 个单词";
      });
      return;
    }

    if (extraComplete) {
      elements.extraHint.textContent = `本组加练已完成：${extraDone} / ${extraTotal}。可以继续加练下一组。`;
      extraButtons.forEach((button) => {
        button.textContent = "继续加练 10 个";
        button.title = "继续从剩余词库中学习 10 个单词";
      });
    } else {
      elements.extraHint.textContent = `提前背进度：${extraDone} / ${extraTotal}。完成本组后可继续加练。`;
      extraButtons.forEach((button) => {
        button.textContent = "完成当前加练后继续";
        button.title = "先掌握当前加练单词，再开始下一组";
      });
    }
  }

  function speakWord(word) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function getDailyWords(dateKey, sourceWords, count) {
    if (sourceWords.length <= count) return sourceWords.slice();

    const dayNumber = getDayDifference(ANCHOR_DATE, dateKey);
    const slotsPerCycle = Math.floor(sourceWords.length / count);
    const cycleIndex = Math.floor(dayNumber / slotsPerCycle);
    const slotIndex = modulo(dayNumber, slotsPerCycle);
    const shuffled = seededShuffle(sourceWords, `cet6-cycle-${cycleIndex}`);
    const start = slotIndex * count;
    return shuffled.slice(start, start + count);
  }

  function seededShuffle(items, seedText) {
    const result = items.slice();
    let seed = hashString(seedText) >>> 0;

    for (let index = result.length - 1; index > 0; index -= 1) {
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      const random = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      const swapIndex = Math.floor(random * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }

    return result;
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDateFromKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function getDayDifference(startKey, endKey) {
    const start = getDateFromKey(startKey);
    const end = getDateFromKey(endKey);
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.floor((endUtc - startUtc) / 86400000);
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function readState(dateKey) {
    const fallback = {
      date: dateKey,
      checked: [],
      completedDates: [],
      extraWords: [],
      extraChecked: []
    };

    const stored = safeStorageGet(STORAGE_KEY);
    if (!stored) return fallback;

    try {
      const parsed = JSON.parse(stored);
      return {
        date: dateKey,
        checked: parsed.date === dateKey && Array.isArray(parsed.checked) ? parsed.checked : [],
        completedDates: Array.isArray(parsed.completedDates) ? parsed.completedDates : [],
        extraWords: parsed.date === dateKey && Array.isArray(parsed.extraWords) ? parsed.extraWords : [],
        extraChecked: parsed.date === dateKey && Array.isArray(parsed.extraChecked) ? parsed.extraChecked : []
      };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    safeStorageSet(STORAGE_KEY, JSON.stringify({
      date: todayKey,
      checked: Array.from(checkedWords),
      completedDates: Array.from(completedDates),
      extraWords,
      extraChecked: Array.from(extraCheckedWords)
    }));
  }

  function getStreak(completedSet, currentDateKey) {
    let cursor = getDateFromKey(currentDateKey);
    let streak = 0;

    if (!completedSet.has(currentDateKey)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (completedSet.has(getDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  function initTheme() {
    const savedTheme = safeStorageGet(THEME_KEY);
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : (systemPrefersDark ? "dark" : "light"));
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    elements.themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    elements.themeToggle.setAttribute("aria-label", theme === "dark" ? "切换浅色模式" : "切换深色模式");

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#111713" : "#f5f7f3");
    }
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The site still works for the current session when storage is unavailable.
    }
  }
})();
