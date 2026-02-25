document.addEventListener("DOMContentLoaded", () => {
  const parseCommaSeparatedDataset = (section, key) => {
    const sources = section?.dataset?.[key];
    if (!sources) return [];
    return sources
      .split(",")
      .map((source) => source.trim())
      .filter(Boolean);
  };

  const parseHeroMediaSources = (section) =>
    parseCommaSeparatedDataset(section, "heroMedia");
  const parseHeroFallbackSources = (section) =>
    parseCommaSeparatedDataset(section, "heroMediaFallback");
  const buildHeroFallbackSources = (mediaSources, fallbackSources) => {
    if (fallbackSources.length === mediaSources.length) return fallbackSources;

    return mediaSources.map(
      (source, index) =>
        fallbackSources[index] || source.replace(/\.mp4(?=$|\?)/i, ".webp"),
    );
  };
  const getMediaSource = (mediaElement) => {
    if (!mediaElement) return "";
    const attrSrc = mediaElement.getAttribute("src");
    if (attrSrc) return attrSrc;
    if (mediaElement.tagName === "VIDEO") {
      const sourceNode = mediaElement.querySelector("source");
      if (sourceNode?.getAttribute("src")) return sourceNode.getAttribute("src");
      if (mediaElement.currentSrc) return mediaElement.currentSrc;
    }
    return "";
  };
  const findMediaIndex = (sources, mediaSource) => {
    if (!sources?.length || !mediaSource) return -1;

    const normalizedSource = mediaSource.split("?")[0];
    return sources.findIndex((source) => {
      const normalizedCandidate = source.split("?")[0];
      return (
        normalizedSource === normalizedCandidate ||
        normalizedSource.endsWith(`/${normalizedCandidate}`)
      );
    });
  };

  const heroSections = Array.from(document.querySelectorAll(".hero-section"));
  const heroContexts = heroSections.map((section) => {
    const heroTexts = section.querySelectorAll(".hero-text");
    const videoContainer = section.querySelector(".video-container");
    const mediaSources = parseHeroMediaSources(section);
    const mediaFallbackSources = buildHeroFallbackSources(
      mediaSources,
      parseHeroFallbackSources(section),
    );
    const mediaSlots = Array.from(
      videoContainer?.querySelectorAll(".hero-media") ?? [],
    );
    const activeSlotIndex = mediaSlots.findIndex((slot) =>
      slot.classList.contains("is-active"),
    );
    const activeMediaSlot = activeSlotIndex === -1 ? 0 : activeSlotIndex;
    const initialMediaIndex =
      mediaSources.length && mediaSlots.length
        ? findMediaIndex(mediaSources, getMediaSource(mediaSlots[activeMediaSlot]))
        : -1;

    return {
      section,
      sticky: section.querySelector(".hero-sticky"),
      videoContainer,
      textFlow: section.querySelector(".hero-text-flow"),
      heroTexts,
      dots: section.querySelectorAll(".dot"),
      totalSlides: heroTexts.length,
      isSecondary: section.classList.contains("hero-section-secondary"),
      mediaSources,
      mediaFallbackSources,
      mediaSlots,
      activeMediaSlot,
      slotMediaIndices: mediaSlots.map((slot, slotIndex) => {
        const index = findMediaIndex(mediaSources, getMediaSource(slot));
        if (index >= 0) return index;
        return slotIndex === activeMediaSlot
          ? initialMediaIndex >= 0
            ? initialMediaIndex
            : 0
          : -1;
      }),
      currentMediaIndex:
        initialMediaIndex >= 0
          ? initialMediaIndex
          : mediaSources.length
            ? 0
            : -1,
      lastOpacity: -1,
      lastScale: -1,
      lastProgress: -1,
      lastMorph: -1,
      lastActiveIndex: -1,
    };
  });

  const primaryHero = heroContexts.find((hero) => !hero.isSecondary) || null;
  const secondaryHero = heroContexts.find((hero) => hero.isSecondary) || null;
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const HERO_PROGRESS_FADE_WINDOW = 0.08;

  const refreshHeroMediaSlots = (hero) => {
    if (!hero?.videoContainer) return [];
    const slots = Array.from(hero.videoContainer.querySelectorAll(".hero-media"));
    hero.mediaSlots = slots;
    if (!Array.isArray(hero.slotMediaIndices)) {
      hero.slotMediaIndices = slots.map((slot) =>
        findMediaIndex(hero.mediaSources, getMediaSource(slot)),
      );
    } else if (hero.slotMediaIndices.length !== slots.length) {
      hero.slotMediaIndices = slots.map((slot, index) => {
        const sourceIndex = findMediaIndex(hero.mediaSources, getMediaSource(slot));
        if (sourceIndex >= 0) return sourceIndex;
        return hero.slotMediaIndices[index] ?? -1;
      });
    }
    const activeIndex = slots.findIndex((slot) => slot.classList.contains("is-active"));
    hero.activeMediaSlot = activeIndex >= 0 ? activeIndex : 0;
    return slots;
  };

  const ensureHeroMediaSlots = (hero) => {
    if (!hero?.videoContainer) return [];
    let slots = refreshHeroMediaSlots(hero);
    if (!slots.length) return [];
    if (slots.length >= 2) {
      slots.forEach((slot) => {
        slot.style.transition = "opacity 0s linear";
        slot.style.webkitTransition = "opacity 0s linear";
      });
      return slots;
    }

    const baseSlot = slots[0];
    const cloneSlot = baseSlot.cloneNode(true);
    cloneSlot.classList.remove("is-active");

    if (cloneSlot.tagName === "VIDEO") {
      cloneSlot.dataset.autoplayTried = "false";
    }

    const overlay = hero.videoContainer.querySelector(".video-overlay");
    hero.videoContainer.insertBefore(cloneSlot, overlay || null);
    slots = refreshHeroMediaSlots(hero);
    hero.slotMediaIndices = [hero.slotMediaIndices?.[0] ?? hero.currentMediaIndex, -1];
    slots.forEach((slot) => {
      slot.style.transition = "opacity 0s linear";
      slot.style.webkitTransition = "opacity 0s linear";
    });
    return slots;
  };

  const preloadHeroMedia = (sources) => {
    sources.forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  };

  heroContexts.forEach((hero) => {
    if (hero.mediaFallbackSources?.length) preloadHeroMedia(hero.mediaFallbackSources);
  });

  const fallbackToImage = (video) => {
    if (!video?.isConnected) return;
    const fallbackSrc = video.dataset.fallbackSrc || video.getAttribute("poster");
    if (!fallbackSrc) return;

    const img = document.createElement("img");
    img.src = fallbackSrc;
    img.alt = video.dataset.fallbackAlt || "App Screenshot";
    img.className = Array.from(video.classList)
      .filter(
        (className) =>
          className !== "phone-screenshot-video" &&
          className !== "hero-media-video",
      )
      .join(" ");
    if (video.classList.contains("phone-screenshot")) {
      img.classList.add("phone-screenshot");
    }
    if (video.classList.contains("hero-media")) {
      img.classList.add("hero-media");
    }
    img.draggable = false;
    img.loading = video.classList.contains("hero-media") ? "eager" : "lazy";
    img.decoding = "async";
    video.replaceWith(img);
  };

  const tryAutoplay = (video, options = {}) => {
    const { forceRetry = false } = options;
    if (!video || video.tagName !== "VIDEO") return;
    if (
      !forceRetry &&
      video.dataset.autoplayTried === "true" &&
      !video.paused &&
      !video.ended
    ) {
      return;
    }

    video.dataset.autoplayTried = "true";
    video.dataset.autoplayFailures = video.dataset.autoplayFailures || "0";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    if (video.readyState === 0) {
      video.load();
    }

    let playPromise;
    try {
      playPromise = video.play();
    } catch (error) {
      fallbackToImage(video);
      return;
    }

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise
        .then(() => {
          video.dataset.autoplayFailures = "0";
        })
        .catch((error) => {
          const failures = Number(video.dataset.autoplayFailures || "0") + 1;
          video.dataset.autoplayFailures = `${failures}`;
          const isTransientError =
            error?.name === "AbortError" || error?.name === "NotAllowedError";
          if (isTransientError && failures < 3 && video.isConnected) {
            window.setTimeout(() => {
              if (!video.isConnected) return;
              tryAutoplay(video, { forceRetry: true });
            }, 120);
            return;
          }

        fallbackToImage(video);
        });
    }
  };

  const setHeroSlotSource = (hero, slotIndex, mediaIndex) => {
    const slots = hero.mediaSlots || [];
    const media = slots[slotIndex];
    if (!media || mediaIndex < 0 || mediaIndex >= hero.mediaSources.length) return;
    if (hero.slotMediaIndices?.[slotIndex] === mediaIndex) return;

    const videoSrc = hero.mediaSources[mediaIndex];
    const fallbackSrc =
      hero.mediaFallbackSources?.[mediaIndex] ||
      videoSrc.replace(/\.mp4(?=$|\?)/i, ".webp");

    if (media.tagName === "IMG") {
      media.src = fallbackSrc || videoSrc;
      media.setAttribute("data-src", media.src);
      hero.slotMediaIndices[slotIndex] = mediaIndex;
      return;
    }

    if (media.tagName === "VIDEO") {
      media.preload = "auto";
      if (fallbackSrc) {
        media.poster = fallbackSrc;
        media.dataset.fallbackSrc = fallbackSrc;
      }

      const currentSrc = media.getAttribute("data-src") || media.getAttribute("src") || "";
      if (currentSrc !== videoSrc) {
        media.setAttribute("data-src", videoSrc);
        media.setAttribute("src", videoSrc);
        media.load();
      }

      media.dataset.autoplayTried = "false";
      tryAutoplay(media, { forceRetry: true });
      hero.slotMediaIndices[slotIndex] = mediaIndex;
    }
  };

  const isSlotMediaReady = (media) => {
    if (!media) return false;
    if (media.tagName === "IMG") {
      return media.complete && media.naturalWidth > 0;
    }
    if (media.tagName === "VIDEO") {
      return media.readyState >= 2;
    }
    return true;
  };

  const ensureSlotForMedia = (hero, mediaIndex, preferredSlotIndex = 0) => {
    const slots = hero.mediaSlots || [];
    if (!slots.length) return -1;

    const existingSlotIndex = hero.slotMediaIndices.findIndex(
      (index) => index === mediaIndex,
    );
    if (existingSlotIndex >= 0) return existingSlotIndex;

    const boundedPreferred = Math.min(
      Math.max(preferredSlotIndex, 0),
      slots.length - 1,
    );
    setHeroSlotSource(hero, boundedPreferred, mediaIndex);
    return boundedPreferred;
  };

  const initAutoplayFallbackVideos = () => {
    const autoplayVideos = Array.from(
      document.querySelectorAll("video[data-fallback-src]"),
    );
    if (!autoplayVideos.length) return;

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);

    autoplayVideos.forEach((video) => {
      video.addEventListener(
        "error",
        () => {
          fallbackToImage(video);
        },
        { once: true },
      );
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target;
            if (!entry.isIntersecting) return;
            if (video.paused || video.ended) {
              tryAutoplay(video, { forceRetry: true });
            }
          });
        },
        { threshold: [0, 0.2, 0.5] },
      );

      autoplayVideos.forEach((video) => {
        if (isIOSDevice && video.classList.contains("hero-media-video")) {
          tryAutoplay(video);
          return;
        }
        observer.observe(video);
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        autoplayVideos.forEach((video) => {
          if (!video.isConnected || !video.paused) return;
          tryAutoplay(video, { forceRetry: true });
        });
      });
    } else {
      autoplayVideos.forEach((video) => {
        tryAutoplay(video);
      });
    }
  };

  initAutoplayFallbackVideos();

  const initHeroWordSwap = () => {
    const verbNode = document.querySelector('[data-hero-swap="verb"]');
    const targetNode = document.querySelector('[data-hero-swap="target"]');
    const sentenceNode = document.querySelector(".swap-line");
    if (!verbNode || !targetNode || !sentenceNode) return;

    const states = [
      { verb: "Build", target: "music" },
      { verb: "Blind", target: "music" },
      { verb: "Build", target: "career" },
    ];
    let stateIndex = 0;
    const reduceMotionRequested = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const updateAriaLabel = (state) => {
      sentenceNode.setAttribute(
        "aria-label",
        `${state.verb} your ${state.target}.`,
      );
    };

    const swapWord = (node, nextValue) => {
      if (!node || node.textContent === nextValue) return;
      if (reduceMotionRequested) {
        node.textContent = nextValue;
        return;
      }

      node.classList.add("is-swapping");
      window.setTimeout(() => {
        node.textContent = nextValue;
        node.classList.remove("is-swapping");
      }, 140);
    };

    updateAriaLabel(states[stateIndex]);
    window.setInterval(() => {
      stateIndex = (stateIndex + 1) % states.length;
      const nextState = states[stateIndex];
      swapWord(verbNode, nextState.verb);
      swapWord(targetNode, nextState.target);
      updateAriaLabel(nextState);
    }, reduceMotionRequested ? 2200 : 1800);
  };

  initHeroWordSwap();

  let isLowPowerMode = false;
  let frameSkipCounter = 0;
  const FRAME_SKIP_THRESHOLD = 2;

  if ("getBattery" in navigator) {
    navigator.getBattery().then((battery) => {
      const checkLowPower = () => {
        isLowPowerMode = battery.level <= 0.2 && !battery.charging;
      };
      checkLowPower();
      battery.addEventListener("levelchange", checkLowPower);
      battery.addEventListener("chargingchange", checkLowPower);
    });
  }

  const detectReducedMotion = () => {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const prefersReducedMotion = detectReducedMotion();
  let lenis = null;

  if (!prefersReducedMotion && typeof Lenis !== "undefined") {
    lenis = new Lenis({
      autoRaf: true,
    });
  }

  const getScrollY = () => {
    if (!lenis) return window.scrollY;
    if (typeof lenis.scroll === "number") return lenis.scroll;
    if (typeof lenis.animatedScroll === "number") return lenis.animatedScroll;
    return window.scrollY;
  };

  const getHeroMetrics = (hero, viewportHeight, scrollY) => {
    const heroHeight = hero.sectionHeight ?? hero.section.offsetHeight;
    const scrollableHeight =
      hero.scrollableHeight ?? Math.max(heroHeight - viewportHeight, 1);
    const sectionTop =
      hero.sectionTop ?? hero.section.getBoundingClientRect().top + scrollY;
    const scrollTop = scrollY - sectionTop;
    const progress = clamp01(scrollTop / scrollableHeight);

    return { heroHeight, scrollableHeight, scrollTop, progress };
  };

  const getHeroEntryWindow = (scrollableHeight, viewportHeight) => {
    const entryWindow = Math.min(scrollableHeight * 0.3, viewportHeight * 0.8);
    return Math.max(entryWindow, 1);
  };

  const getSecondaryTextProgress = (metrics, viewportHeight) => {
    const entryWindow = getHeroEntryWindow(
      metrics.scrollableHeight,
      viewportHeight,
    );
    const entryLead = Math.min(viewportHeight * 0.2, entryWindow * 0.3);
    const entryStart = -entryLead;
    const entryProgress = clamp01(
      (metrics.scrollTop - entryStart) / entryWindow,
    );
    const textStart = entryWindow - entryLead;
    const contentRange = Math.max(metrics.scrollableHeight - textStart, 1);
    const contentProgress = clamp01(
      (metrics.scrollTop - textStart) / contentRange,
    );
    const textProgress = entryProgress < 1 ? 0 : contentProgress;

    return {
      entryProgress,
      textProgress,
      contentProgress,
      entryStart,
      textStart,
    };
  };

  const swapHeroMedia = (hero, textProgress) => {
    if (!hero || !hero.mediaSources?.length) return;
    const slots = ensureHeroMediaSlots(hero);
    if (!slots.length) return;

    const maxIndex = Math.max(hero.mediaSources.length - 1, 0);
    const scaled = clamp01(textProgress) * maxIndex;
    const segmentStart = Math.min(Math.max(Math.floor(scaled), 0), maxIndex);
    const segmentEnd = Math.min(segmentStart + 1, maxIndex);
    const localProgress = scaled - segmentStart;
    const fadeStart = 0.5 - HERO_PROGRESS_FADE_WINDOW;
    const fadeEnd = 0.5 + HERO_PROGRESS_FADE_WINDOW;

    let fromIndex = segmentStart;
    let toIndex = segmentStart;
    let fadeAmount = 0;

    if (segmentEnd > segmentStart) {
      if (localProgress < fadeStart) {
        fromIndex = segmentStart;
        toIndex = segmentStart;
      } else if (localProgress > fadeEnd) {
        fromIndex = segmentEnd;
        toIndex = segmentEnd;
      } else {
        fromIndex = segmentStart;
        toIndex = segmentEnd;
        fadeAmount = clamp01(
          (localProgress - fadeStart) / Math.max(fadeEnd - fadeStart, 0.0001),
        );
      }
    }

    const primarySlotIndex = ensureSlotForMedia(
      hero,
      fromIndex,
      hero.activeMediaSlot ?? 0,
    );
    if (primarySlotIndex < 0) return;

    let secondarySlotIndex = -1;
    if (toIndex !== fromIndex) {
      secondarySlotIndex = ensureSlotForMedia(
        hero,
        toIndex,
        primarySlotIndex === 0 ? 1 : 0,
      );
      if (secondarySlotIndex >= 0) {
        const secondaryMedia = slots[secondarySlotIndex];
        if (!isSlotMediaReady(secondaryMedia)) {
          fadeAmount = 0;
        }
      }
    }

    slots.forEach((slot, index) => {
      if (index === primarySlotIndex) {
        slot.style.zIndex = "2";
        slot.style.opacity = `${(1 - fadeAmount).toFixed(3)}`;
        if (!slot.classList.contains("is-active")) slot.classList.add("is-active");
        return;
      }

      if (index === secondarySlotIndex) {
        slot.style.zIndex = "1";
        slot.style.opacity = "1";
        if (!slot.classList.contains("is-active")) slot.classList.add("is-active");
        return;
      }

      slot.style.zIndex = "0";
      slot.style.opacity = "0";
      slot.classList.remove("is-active");
    });

    if (secondarySlotIndex >= 0 && fadeAmount >= 0.999) {
      hero.activeMediaSlot = secondarySlotIndex;
      hero.currentMediaIndex = toIndex;
      return;
    }

    hero.activeMediaSlot = primarySlotIndex;
    hero.currentMediaIndex = fromIndex;
  };

  function updateHeroByScroll(scrollYOverride) {
    if (!layoutCacheValid) updateLayoutCache();
    const viewportHeight = cachedViewportHeight || window.innerHeight;
    const scrollY = scrollYOverride ?? getScrollY();

    heroContexts.forEach((hero) => {
      if (!hero.section || !hero.textFlow || hero.totalSlides === 0) return;

      const metrics = getHeroMetrics(hero, viewportHeight, scrollY);
      const rawTextProgress = hero.isSecondary
        ? getSecondaryTextProgress(metrics, viewportHeight).textProgress
        : metrics.progress;
      const shouldSnapToStart = !hero.isSecondary && metrics.scrollTop <= 2;
      const textProgress = shouldSnapToStart ? 0 : rawTextProgress;

      const textFlowScrollHeight =
        hero.textFlow.scrollHeight - hero.textFlow.clientHeight;
      const activeDot = Math.min(
        Math.round(textProgress * (hero.totalSlides - 1)),
        hero.totalSlides - 1,
      );
      swapHeroMedia(hero, textProgress);

      const targetScrollTop = textProgress * textFlowScrollHeight;
      if (shouldSnapToStart) {
        if (hero.textFlow.scrollTop !== 0) {
          hero.textFlow.scrollTop = 0;
        }
      } else if (Math.abs(hero.textFlow.scrollTop - targetScrollTop) > 0.5) {
        hero.textFlow.scrollTop = targetScrollTop;
      }
      if (hero.lastActiveIndex !== activeDot) {
        hero.lastActiveIndex = activeDot;

        const activeText = hero.heroTexts[activeDot];
        if (activeText && hero.section) {
          const highlight = activeText.querySelector(".highlight");
          const colorSource =
            highlight || activeText.querySelector(".hero-quote") || activeText;
          if (colorSource) {
            const accentColor = getComputedStyle(colorSource).color;
            if (accentColor) {
              hero.section.style.setProperty("--hero-accent", accentColor);
            }
          }
        }
      }

      hero.dots.forEach((dot, i) =>
        dot.classList.toggle("active", i === activeDot),
      );
    });
  }

  let ticking = false;
  let lastScrollY = -1;
  let pendingScrollY = -1;

  const runScrollUpdates = (currentScrollY) => {
    updateHeroByScroll(currentScrollY);
    updateVideoByScroll(currentScrollY);
    updateNavbarByScroll(currentScrollY);
    updateFeatureByScroll(currentScrollY);
  };

  const onScroll = (scrollYOverride) => {
    if (isLowPowerMode) {
      frameSkipCounter++;
      if (frameSkipCounter < FRAME_SKIP_THRESHOLD) return;
      frameSkipCounter = 0;
    }

    const currentScrollY = scrollYOverride ?? getScrollY();
    pendingScrollY = currentScrollY;
    if (ticking) return;

    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      const scrollY = pendingScrollY;
      const shouldForceNearTopUpdate = scrollY <= 1 || lastScrollY <= 1;
      if (
        Math.abs(scrollY - lastScrollY) < 0.2 &&
        !shouldForceNearTopUpdate
      ) {
        return;
      }
      lastScrollY = scrollY;
      runScrollUpdates(scrollY);
    });
  };

  if (lenis) {
    lenis.on("scroll", (event) => {
      onScroll(event && typeof event.scroll === "number" ? event.scroll : null);
    });
  } else {
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  window.addEventListener(
    "resize",
    () => {
      if (lenis) lenis.resize();
      lastScrollY = -1;
      onScroll(getScrollY());
    },
    { passive: true },
  );

  const startScrollPolling = () => {
    let lastPolledScrollY = getScrollY();
    const poll = () => {
      const current = getScrollY();
      const hasScrollDelta = Math.abs(current - lastPolledScrollY) > 0.1;
      const shouldForceNearTopPoll = current <= 1 || lastPolledScrollY <= 1;
      if (hasScrollDelta || shouldForceNearTopPoll) {
        lastPolledScrollY = current;
        onScroll(current);
      }
      window.requestAnimationFrame(poll);
    };
    window.requestAnimationFrame(poll);
  };
  startScrollPolling();

  const primaryHeroSection = primaryHero?.section ?? null;
  const primaryHeroSticky = primaryHero?.sticky ?? null;
  const primaryVideoContainer = primaryHero?.videoContainer ?? null;
  const primaryHeroTextFlow = primaryHero?.textFlow ?? null;

  const secondaryHeroSection = secondaryHero?.section ?? null;
  const secondaryHeroSticky = secondaryHero?.sticky ?? null;
  const secondaryVideoContainer = secondaryHero?.videoContainer ?? null;
  const secondaryHeroTextFlow = secondaryHero?.textFlow ?? null;

  const navbar = document.querySelector(".navbar");
  const navContainer = document.querySelector(".nav-container");
  const appSection = document.querySelector(".app-section");
  const featureScrollContainers = Array.from(
    document.querySelectorAll(".feature-scroll-container"),
  );
  const featureItems = featureScrollContainers.map((container) => ({
    container,
    textContent: container.querySelector(".feature-text-content"),
    top: 0,
  }));

  let cachedIsMobile = window.innerWidth <= 768;
  const isMobile = () => cachedIsMobile;

  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

  let lastPrimaryProgress = -1;
  let lastPrimaryScale = -1;
  let lastNavProgress = -1;
  let heroNavActive = false;

  const resetHeroInlineStyles = (hero, useMobile) => {
    if (!hero) return;

    if (hero.textFlow) {
      hero.textFlow.style.transform = "";
      hero.textFlow.style.webkitTransform = "";
    }
    if (hero.sticky) {
      hero.sticky.style.transform = "";
      hero.sticky.style.webkitTransform = "";
    }

    if (hero.section && hero.sticky && hero.videoContainer) {
      if (useMobile) {
        hero.section.style.padding = "0";
        hero.sticky.style.top = "0";
        hero.sticky.style.height = "100vh";
        hero.sticky.style.borderRadius = "0";
        hero.videoContainer.style.borderRadius = "0";
      } else {
        hero.section.style.padding = "20px";
        hero.sticky.style.top = "20px";
        hero.sticky.style.height = "calc(100vh - 40px)";
        hero.sticky.style.borderRadius = "32px";
        hero.videoContainer.style.borderRadius = "32px";
      }
    }
  };

  window.addEventListener(
    "resize",
    () => {
      const wasMobile = cachedIsMobile;
      cachedIsMobile = window.innerWidth <= 768;

      if (wasMobile !== cachedIsMobile) {
        lastPrimaryProgress = -1;
        lastPrimaryScale = -1;
        lastNavProgress = -1;

        heroContexts.forEach((hero) => {
          hero.lastOpacity = -1;
          hero.lastScale = -1;
          hero.lastProgress = -1;
          hero.lastMorph = -1;
          hero.lastActiveIndex = -1;
          resetHeroInlineStyles(hero, cachedIsMobile);
        });

        if (cachedIsMobile) {
          navbar.style.setProperty("--nav-pad-y", "18px");
          navContainer.style.setProperty("--nav-pad-x", "24px");
        } else {
          navbar.style.setProperty("--nav-pad-y", "56px");
          navbar.style.setProperty("--nav-bg-alpha", "0");
          navContainer.style.setProperty("--nav-pad-x", "72px");
        }

        featureItems.forEach((item) => {
          const textContent = item.textContent;
          if (!textContent) return;
          textContent.style.transform = "";
          textContent.style.webkitTransform = "";
          textContent.style.opacity = "";
        });

        layoutCacheValid = false;
        requestAnimationFrame(() => {
          const currentScrollY = getScrollY();
          updateHeroByScroll(currentScrollY);
          updateVideoByScroll(currentScrollY);
          updateNavbarByScroll(currentScrollY);
          updateFeatureByScroll(currentScrollY);
        });
      }
    },
    { passive: true },
  );

  let cachedPrimaryHeroHeight = 0;
  let cachedSecondaryHeroHeight = 0;
  let cachedViewportHeight = 0;
  let cachedNavbarHeight = 0;
  let cachedAppSectionTop = 0;
  let layoutCacheValid = false;

  const updateLayoutCache = () => {
    const scrollY = getScrollY();
    cachedPrimaryHeroHeight = primaryHeroSection?.offsetHeight ?? 0;
    cachedSecondaryHeroHeight = secondaryHeroSection?.offsetHeight ?? 0;
    cachedViewportHeight = window.innerHeight;
    cachedNavbarHeight = navbar?.offsetHeight ?? 0;
    cachedAppSectionTop = appSection
      ? appSection.getBoundingClientRect().top + scrollY
      : 0;

    heroContexts.forEach((hero) => {
      if (!hero.section) return;
      hero.sectionTop = hero.section.getBoundingClientRect().top + scrollY;
      hero.sectionHeight = hero.section.offsetHeight;
      hero.scrollableHeight = Math.max(
        hero.sectionHeight - cachedViewportHeight,
        1,
      );
    });

    featureItems.forEach((item) => {
      if (!item.container) return;
      item.top = item.container.getBoundingClientRect().top + scrollY;
    });
    layoutCacheValid = true;
  };

  window.addEventListener(
    "resize",
    () => {
      layoutCacheValid = false;
    },
    { passive: true },
  );

  const applyNavProgress = (progress) => {
    const eased = progress;
    const blurMax = 14;
    const navBlur = blurMax * eased;

    if (navbar && !isMobile()) {
      const padYExpanded = 56;
      const padYOriginal = 18;
      const padY = padYExpanded - (padYExpanded - padYOriginal) * eased;
      navbar.style.setProperty("--nav-pad-y", `${padY.toFixed(2)}px`);

      const bgAlphaMax = 0.58;
      const bgAlpha = bgAlphaMax * eased;
      navbar.style.setProperty("--nav-bg-alpha", `${bgAlpha.toFixed(3)}`);
      navbar.style.setProperty("--nav-blur", `${navBlur.toFixed(2)}px`);
    } else if (navbar && isMobile()) {
      navbar.style.setProperty("--nav-pad-y", "18px");
      const bgAlphaMax = 0.58;
      navbar.style.setProperty(
        "--nav-bg-alpha",
        `${(bgAlphaMax * eased).toFixed(3)}`,
      );
      navbar.style.setProperty("--nav-blur", `${navBlur.toFixed(2)}px`);
    }

    if (navContainer && !isMobile()) {
      const padXExpanded = 72;
      const padXOriginal = 24;
      const padX = padXExpanded - (padXExpanded - padXOriginal) * eased;
      navContainer.style.setProperty("--nav-pad-x", `${padX.toFixed(2)}px`);
    } else if (navContainer && isMobile()) {
      navContainer.style.setProperty("--nav-pad-x", "24px");
    }
  };

  function updateVideoByScroll(scrollYOverride) {
    const scrollY = scrollYOverride ?? getScrollY();

    if (!layoutCacheValid) updateLayoutCache();
    const viewportHeight = cachedViewportHeight;

    if (primaryHeroSection && primaryVideoContainer) {
      const heroHeight =
        cachedPrimaryHeroHeight || primaryHeroSection.offsetHeight;
      const opacity = 1 - (scrollY / Math.max(heroHeight, 1)) * 0.5;
      const clampedOpacity = Math.min(Math.max(opacity, 0), 1);

      const currentOpacity =
        parseFloat(primaryVideoContainer.style.opacity) || 1;
      if (Math.abs(clampedOpacity - currentOpacity) > 0.01) {
        primaryVideoContainer.style.opacity = clampedOpacity.toFixed(2);
      }
    }

    if (secondaryHeroSection && secondaryVideoContainer) {
      const currentOpacity =
        parseFloat(secondaryVideoContainer.style.opacity) || 1;
      if (Math.abs(1 - currentOpacity) > 0.01) {
        secondaryVideoContainer.style.opacity = "1";
      }
    }

    let navProgress = null;

    if (appSection) {
      const appTop = cachedAppSectionTop - scrollY;

      const denom = Math.max(viewportHeight - cachedNavbarHeight, 1);
      const progress = clamp01((viewportHeight - appTop) / denom);
      navProgress = progress;
      const shouldForceTopReset = scrollY <= 2 && progress <= 0.02;

      const progressChanged = Math.abs(progress - lastPrimaryProgress) > 0.005;
      if (progressChanged || shouldForceTopReset) {
        lastPrimaryProgress = progress;

        const eased = progress;

        if (primaryHeroSticky) {
          const scale = shouldForceTopReset ? 1 : 1 - eased * 0.25;

          if (Math.abs(scale - lastPrimaryScale) > 0.002) {
            const scaleStr = scale.toFixed(4);
            const stickyTransform = `scale(${scaleStr}) translateZ(0)`;
            primaryHeroSticky.style.transform = stickyTransform;
            primaryHeroSticky.style.webkitTransform = stickyTransform;

            if (primaryHeroTextFlow) {
              const flowTransform = `scale(${scaleStr}) translateZ(0)`;
              primaryHeroTextFlow.style.transform = flowTransform;
              primaryHeroTextFlow.style.webkitTransform = flowTransform;
            }
            lastPrimaryScale = scale;
          }

          if (isMobile()) {
            const easedRadius = easeOutQuad(eased);
            const maxRadius = 32;
            const radius = Math.round(easedRadius * maxRadius);
            const maxPadding = 20;
            const padding = Math.round(easedRadius * maxPadding);

            if (
              primaryHeroSection &&
              primaryVideoContainer &&
              primaryHeroSticky
            ) {
              primaryHeroSection.style.padding = `${padding}px`;
              primaryHeroSticky.style.top = `${padding}px`;
              primaryHeroSticky.style.height = `calc(100vh - ${padding * 2}px)`;
              primaryHeroSticky.style.borderRadius = `${radius}px`;
              primaryVideoContainer.style.borderRadius = `${radius}px`;
            }
          }
        }
      }
    }

    heroNavActive = false;

    if (secondaryHero && secondaryHeroSection && secondaryHeroSticky) {
      const metrics = getHeroMetrics(secondaryHero, viewportHeight, scrollY);
      const { entryProgress, contentProgress, entryStart } =
        getSecondaryTextProgress(metrics, viewportHeight);
      heroNavActive =
        metrics.scrollTop >= entryStart &&
        metrics.scrollTop <= metrics.scrollableHeight;
      if (heroNavActive) {
        if (entryProgress < 1) {
          navProgress = 1 - entryProgress;
        } else {
          const collapseStart = 0.9;
          const collapseProgress =
            contentProgress <= collapseStart
              ? 0
              : (contentProgress - collapseStart) / (1 - collapseStart);
          navProgress = collapseProgress;
        }
      }
      const eased = easeOutQuad(entryProgress);
      const scale = 0.75 + 0.25 * eased;

      if (Math.abs(scale - secondaryHero.lastScale) > 0.002) {
        const scaleStr = scale.toFixed(4);
        const stickyTransform = `scale(${scaleStr}) translateZ(0)`;
        secondaryHeroSticky.style.transform = stickyTransform;
        secondaryHeroSticky.style.webkitTransform = stickyTransform;

        if (secondaryHeroTextFlow) {
          const flowTransform = `scale(${scaleStr}) translateZ(0)`;
          secondaryHeroTextFlow.style.transform = flowTransform;
          secondaryHeroTextFlow.style.webkitTransform = flowTransform;
        }
        secondaryHero.lastScale = scale;
      }

      if (isMobile()) {
        const maxRadius = 32;
        const maxPadding = 20;
        const radius = Math.round((1 - eased) * maxRadius);
        const padding = Math.round((1 - eased) * maxPadding);

        if (secondaryVideoContainer && secondaryHeroSection) {
          secondaryHeroSection.style.padding = `${padding}px`;
          secondaryHeroSticky.style.top = `${padding}px`;
          secondaryHeroSticky.style.height = `calc(100vh - ${padding * 2}px)`;
          secondaryHeroSticky.style.borderRadius = `${radius}px`;
          secondaryVideoContainer.style.borderRadius = `${radius}px`;
        }
      }
    }

    if (navProgress !== null) {
      const navChanged = Math.abs(navProgress - lastNavProgress) > 0.005;
      if (navChanged) {
        lastNavProgress = navProgress;
        applyNavProgress(navProgress);
      }
    }
  }

  const featureStateCache = new WeakMap();

  function updateFeatureByScroll(scrollYOverride) {
    if (!layoutCacheValid) updateLayoutCache();
    const viewportHeight = cachedViewportHeight;
    const scrollY = scrollYOverride ?? getScrollY();

    featureItems.forEach((item) => {
      const textContent = item.textContent;
      if (!textContent) return;

      const scrollProgress = clamp01(
        (scrollY - item.top) / (viewportHeight * 0.5),
      );

      const lastState = featureStateCache.get(textContent) || { progress: -1 };
      if (Math.abs(scrollProgress - lastState.progress) < 0.004) return;

      featureStateCache.set(textContent, { progress: scrollProgress });

      const textScale = 1 - scrollProgress * 0.2;
      const textOpacity = 1 - scrollProgress;
      const featureTransform = `translate(-50%, -50%) scale(${textScale.toFixed(
        4,
      )}) translateZ(0)`;
      textContent.style.transform = featureTransform;
      textContent.style.webkitTransform = featureTransform;
      textContent.style.opacity = textOpacity.toFixed(2);
    });
  }

  let lastScrolled = false;

  function updateNavbarByScroll(scrollYOverride) {
    if (!navbar || !appSection) return;
    if (heroNavActive) {
      if (lastScrolled) {
        lastScrolled = false;
        navbar.classList.remove("scrolled");
      }
      return;
    }
    if (!layoutCacheValid) updateLayoutCache();
    const scrollY = scrollYOverride ?? getScrollY();
    const navbarHeight = cachedNavbarHeight || navbar.offsetHeight;
    const appSectionTop = cachedAppSectionTop - scrollY;
    const shouldBeScrolled = appSectionTop <= navbarHeight;

    if (shouldBeScrolled !== lastScrolled) {
      lastScrolled = shouldBeScrolled;
      if (shouldBeScrolled) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    }
  }

  const navToggle = document.querySelector(".nav-toggle");
  const navMenus = document.querySelectorAll(".nav-menu");
  const navLogo = document.querySelector(".nav-logo");

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const scrollToTarget = (target) => {
    if (!target) return;
    const targetTop = target.getBoundingClientRect().top + window.pageYOffset;

    if (lenis) {
      lenis.scrollTo(targetTop, {
        duration: prefersReducedMotion ? 0 : 1.2,
        easing: easeOutCubic,
      });
      return;
    }

    if (prefersReducedMotion) {
      window.scrollTo(0, targetTop);
    } else {
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    if (lenis) {
      lenis.scrollTo(0, {
        duration: prefersReducedMotion ? 0 : 1.2,
        easing: easeOutCubic,
      });
      return;
    }

    if (prefersReducedMotion) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeMobileNav = () => {
    navMenus.forEach((menu) => menu.classList.remove("active"));
    if (navToggle) navToggle.classList.remove("active");
  };

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      navToggle.classList.add("animating");
      navToggle.classList.toggle("active");
      navMenus.forEach((menu) => menu.classList.toggle("active"));
    });

    navToggle.addEventListener("transitionend", () => {
      navToggle.classList.remove("animating");
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#") && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          event.preventDefault();
          scrollToTarget(target);
        }
      }

      closeMobileNav();
    });
  });

  if (navLogo) {
    navLogo.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToTop();

      closeMobileNav();
    });
  }

  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      faqItems.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.classList.remove("active");
        }
      });
      item.classList.toggle("active");
    });
  });

  const finePointerQuery = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  );
  const coarsePointerQuery = window.matchMedia(
    "(hover: none), (pointer: coarse)"
  );
  const bentoCards = document.querySelectorAll(".bento-card");
  const updateTopBentoToggle = () => {
    const topCards = document.querySelectorAll(".bento-card--top");
    const isMobileView = window.innerWidth <= 768;
    topCards.forEach((card) => {
      if (isMobileView) {
        card.style.setProperty("--top-toggle-x", "50%");
        return;
      }
      const media = card.querySelector(".bento-media");
      if (!media) return;
      const image = media.querySelector("img") || media;
      const cardRect = card.getBoundingClientRect();
      const mediaRect = image.getBoundingClientRect();
      const midpoint = Math.max((mediaRect.left - cardRect.left) / 2, 0);
      card.style.setProperty("--top-toggle-x", `${midpoint}px`);
    });
  };
  updateTopBentoToggle();
  requestAnimationFrame(updateTopBentoToggle);
  bentoCards.forEach((card) => {
    const toggle = card.querySelector(".bento-toggle");
    const overlay = card.querySelector(".bento-overlay");
    if (!toggle || !overlay) return;

    let rafId = null;
    let pendingPos = null;
    let resetTimer = null;
    let tiltEnabled = false;
    const isTopCard = card.classList.contains("bento-card--top");
    const isPreplay = card.classList.contains("bento-card--preplay");
    const maxTilt = isPreplay ? 8 : 12;
    const pointerTarget = card.querySelector(".bento-media") || card;
    const isMediaEvent = (event) =>
      Boolean(event.target && event.target.closest(".bento-media"));

    const updatePointerEffects = () => {
      rafId = null;
      if (!pendingPos) return;
      const { x, y, tiltX, tiltY, hasTilt } = pendingPos;
      card.style.setProperty("--bento-x", `${x}%`);
      card.style.setProperty("--bento-y", `${y}%`);
      if (hasTilt) {
        card.style.setProperty("--bento-tilt-x", `${tiltX.toFixed(2)}deg`);
        card.style.setProperty("--bento-tilt-y", `${tiltY.toFixed(2)}deg`);
      }
      pendingPos = null;
    };

    const queuePointerUpdate = (event) => {
      if (coarsePointerQuery.matches || event.pointerType === "touch") return;
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
      const cardRect = card.getBoundingClientRect();
      const x = ((event.clientX - cardRect.left) / cardRect.width) * 100;
      const y = ((event.clientY - cardRect.top) / cardRect.height) * 100;
      tiltEnabled =
        finePointerQuery.matches && event.pointerType !== "touch";
      let tiltX = 0;
      let tiltY = 0;
      if (tiltEnabled) {
        const tiltRect = pointerTarget.getBoundingClientRect();
        const localX =
          ((event.clientX - tiltRect.left) / tiltRect.width) * 100;
        const localY =
          ((event.clientY - tiltRect.top) / tiltRect.height) * 100;
        tiltX = ((50 - localY) / 50) * maxTilt;
        tiltY = ((localX - 50) / 50) * maxTilt;
      }
      pendingPos = {
        x: Math.min(Math.max(x, 0), 100),
        y: Math.min(Math.max(y, 0), 100),
        tiltX,
        tiltY,
        hasTilt: tiltEnabled,
      };
      if (!rafId) {
        rafId = requestAnimationFrame(updatePointerEffects);
      }
    };

    const queueGradientUpdate = (event) => {
      if (coarsePointerQuery.matches || event.pointerType === "touch") return;
      if (!isTopCard && isMediaEvent(event)) return;
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      pendingPos = {
        x: Math.min(Math.max(x, 0), 100),
        y: Math.min(Math.max(y, 0), 100),
        tiltX: 0,
        tiltY: 0,
        hasTilt: false,
      };
      tiltEnabled = false;
      if (!rafId) {
        rafId = requestAnimationFrame(updatePointerEffects);
      }
    };

    const resetPointerEffects = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingPos = null;
      tiltEnabled = false;
      card.style.setProperty("--bento-tilt-x", "0deg");
      card.style.setProperty("--bento-tilt-y", "0deg");
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        card.style.setProperty("--bento-x", "50%");
        card.style.setProperty("--bento-y", "50%");
        resetTimer = null;
      }, 320);
    };

    const resetTiltOnly = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingPos = null;
      tiltEnabled = false;
      card.style.setProperty("--bento-tilt-x", "0deg");
      card.style.setProperty("--bento-tilt-y", "0deg");
    };

    if (!isTopCard) {
      pointerTarget.addEventListener("pointerenter", queuePointerUpdate);
      pointerTarget.addEventListener("pointermove", queuePointerUpdate);
      pointerTarget.addEventListener("pointerleave", resetTiltOnly);
      pointerTarget.addEventListener("pointerdown", queuePointerUpdate);
    }

    card.addEventListener("pointerenter", queueGradientUpdate);
    card.addEventListener("pointermove", queueGradientUpdate);
    card.addEventListener("pointerleave", resetPointerEffects);

    if (isPreplay && !isTopCard) {
      const preplayTarget =
        card.querySelector(".bento-media--preplay") || pointerTarget;
      const toggleReveal = () => {
        if (!coarsePointerQuery.matches) return;
        card.classList.toggle("is-reveal");
      };

      preplayTarget.addEventListener("click", toggleReveal);
    }

    toggle.addEventListener("click", () => {
      const isActive = card.classList.toggle("active");
      toggle.setAttribute("aria-expanded", String(isActive));
      overlay.setAttribute("aria-hidden", String(!isActive));
    });
  });

  window.addEventListener("load", () => {
    layoutCacheValid = false;
    onScroll(getScrollY());
    updateTopBentoToggle();
  });

  window.addEventListener(
    "resize",
    () => {
      updateTopBentoToggle();
    },
    { passive: true },
  );

  heroContexts.forEach((hero) => {
    if (hero.sticky) {
      hero.sticky.style.transformOrigin = "center bottom";
      hero.sticky.style.webkitTransformOrigin = "center bottom";
    }
    if (hero.textFlow) {
      hero.textFlow.style.transformOrigin = "center center";
      hero.textFlow.style.webkitTransformOrigin = "center center";
    }
  });

  updateLayoutCache();
  const initialScrollY = getScrollY();
  updateHeroByScroll(initialScrollY);
  updateVideoByScroll(initialScrollY);
  updateNavbarByScroll(initialScrollY);
  updateFeatureByScroll(initialScrollY);
});
