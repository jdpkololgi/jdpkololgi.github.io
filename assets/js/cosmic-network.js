(function () {
  "use strict";

  const PRESETS = {
    cosmicWeb: {
      id: "cosmicWeb",
      label: "Cosmic Web",
      starColor: "136, 173, 255",
      lineColor: "130, 147, 255",
      starCount: 95,
      maxDistance: 140,
      speed: 0.35
    },
    nebulaBurst: {
      id: "nebulaBurst",
      label: "Nebula Burst",
      starColor: "192, 126, 255",
      lineColor: "118, 210, 236",
      starCount: 110,
      maxDistance: 155,
      speed: 0.42
    },
    deepSpace: {
      id: "deepSpace",
      label: "Deep Space",
      starColor: "194, 223, 255",
      lineColor: "99, 131, 194",
      starCount: 80,
      maxDistance: 130,
      speed: 0.28
    }
  };

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createPoint(width, height, speed) {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: randomBetween(-0.6, 0.6) * speed,
      vy: randomBetween(-0.6, 0.6) * speed,
      radius: randomBetween(0.8, 2.2),
      alpha: randomBetween(0.4, 0.95)
    };
  }

  function clampPoint(point, width, height) {
    if (point.x < 0 || point.x > width) {
      point.vx *= -1;
      point.x = Math.max(0, Math.min(point.x, width));
    }
    if (point.y < 0 || point.y > height) {
      point.vy *= -1;
      point.y = Math.max(0, Math.min(point.y, height));
    }
  }

  function makeSystem(canvas, preset) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let points = [];
    let mouse = null;
    let rafId = null;
    let mouseIdleTimer = null;

    function resize() {
      width = Math.max(window.innerWidth, 280);
      height = Math.max(window.innerHeight, 260);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      points = new Array(preset.starCount)
        .fill(null)
        .map(() => createPoint(width, height, preset.speed));
    }

    function drawPoint(point) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${preset.starColor}, ${point.alpha})`;
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawConnection(p1, p2, distance) {
      const opacity = 1 - distance / preset.maxDistance;
      if (opacity <= 0) return;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${preset.lineColor}, ${opacity * 0.45})`;
      ctx.lineWidth = 1;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        p.x += p.vx;
        p.y += p.vy;
        clampPoint(p, width, height);
      }

      for (let i = 0; i < points.length; i += 1) {
        const p1 = points[i];
        drawPoint(p1);

        for (let j = i + 1; j < points.length; j += 1) {
          const p2 = points[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= preset.maxDistance) {
            drawConnection(p1, p2, distance);
          }
        }

        if (mouse) {
          const dm = Math.hypot(p1.x - mouse.x, p1.y - mouse.y);
          if (dm < preset.maxDistance * 1.2) {
            drawConnection(p1, mouse, dm);
          }
        }
      }

      rafId = window.requestAnimationFrame(step);
    }

    function onMouseMove(event) {
      mouse = {
        x: event.clientX,
        y: event.clientY
      };

      if (mouseIdleTimer) {
        window.clearTimeout(mouseIdleTimer);
      }

      // Keep pointer-links visible only while cursor is actively moving.
      mouseIdleTimer = window.setTimeout(function () {
        mouse = null;
      }, 140);
    }

    function onMouseLeave() {
      mouse = null;
      if (mouseIdleTimer) {
        window.clearTimeout(mouseIdleTimer);
        mouseIdleTimer = null;
      }
    }

    function onDocumentMouseOut(event) {
      // When relatedTarget is null, the pointer left the browser viewport.
      if (!event.relatedTarget) {
        onMouseLeave();
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseout", onDocumentMouseOut);
    window.addEventListener("scroll", onMouseLeave, { passive: true });
    window.addEventListener("blur", onMouseLeave);
    window.addEventListener("resize", resize);

    resize();
    step();

    return {
      destroy() {
        if (rafId) window.cancelAnimationFrame(rafId);
        if (mouseIdleTimer) {
          window.clearTimeout(mouseIdleTimer);
          mouseIdleTimer = null;
        }
        window.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseout", onDocumentMouseOut);
        window.removeEventListener("scroll", onMouseLeave);
        window.removeEventListener("blur", onMouseLeave);
        window.removeEventListener("resize", resize);
      }
    };
  }

  function setupPresetSelector(node, onPresetChange) {
    const selector = node.querySelector("[data-cosmic-preset]");
    if (!selector) return;

    const keys = Object.keys(PRESETS);
    selector.innerHTML = keys
      .map((key) => `<option value="${key}">${PRESETS[key].label}</option>`)
      .join("");

    const urlPreset = new URLSearchParams(window.location.search).get("preset");
    const initialPreset = PRESETS[urlPreset] ? urlPreset : selector.value;
    selector.value = initialPreset;
    onPresetChange(initialPreset);

    selector.addEventListener("change", function (event) {
      const key = event.target.value;
      onPresetChange(key);
    });
  }

  function initHomeBackground() {
    const host = document.querySelector("[data-cosmic-home]");
    if (!host) return;
    const canvas = host.querySelector("canvas");
    if (!canvas) return;
    document.body.classList.add("cosmic-homepage");

    let runningSystem = null;

    function mountPreset(key) {
      const preset = PRESETS[key] || PRESETS.cosmicWeb;
      host.setAttribute("data-active-preset", preset.id);
      if (runningSystem) runningSystem.destroy();
      runningSystem = makeSystem(canvas, preset);
    }

    setupPresetSelector(host, mountPreset);

    if (!runningSystem) {
      mountPreset(host.getAttribute("data-default-preset") || "cosmicWeb");
    }

    const searchTrigger = document.querySelector("#search-trigger");
    const searchInput = document.querySelector("#search-input");

    document.addEventListener("keydown", function (event) {
      const isK = event.key && event.key.toLowerCase() === "k";
      if (!isK) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      const target = event.target;
      const isTypingTarget =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTypingTarget) return;

      event.preventDefault();

      if (searchTrigger) {
        searchTrigger.click();
      }

      if (searchInput) {
        window.setTimeout(function () {
          searchInput.focus();
          searchInput.select();
        }, 0);
      }
    });

    const launcherToggle = document.querySelector("[data-cosmic-sidebar-toggle]");
    const sidebar = document.querySelector("#sidebar");

    if (launcherToggle && sidebar) {
      launcherToggle.setAttribute("aria-controls", "sidebar");
      launcherToggle.setAttribute("aria-expanded", "false");

      launcherToggle.addEventListener("click", function () {
        const nextOpen = !document.body.classList.contains("cosmic-sidebar-open");
        document.body.classList.toggle("cosmic-sidebar-open", nextOpen);
        launcherToggle.setAttribute("aria-expanded", String(nextOpen));
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          document.body.classList.remove("cosmic-sidebar-open");
          launcherToggle.setAttribute("aria-expanded", "false");
        }
      });

      document.addEventListener("click", function (event) {
        if (!document.body.classList.contains("cosmic-sidebar-open")) return;
        if (sidebar.contains(event.target)) return;
        if (launcherToggle.contains(event.target)) return;
        document.body.classList.remove("cosmic-sidebar-open");
        launcherToggle.setAttribute("aria-expanded", "false");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initHomeBackground);
})();
