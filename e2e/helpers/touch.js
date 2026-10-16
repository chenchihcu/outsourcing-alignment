/**
 * 觸控尺寸與可及性量測工具 (遵循規格 9A 與 F11 規範)
 */

export async function measureTouchTargets(page) {
  return page.evaluate(() => {
    const selector = 'a, button, input, select, textarea, label:has(input), [role=button], [role=tab], [role=link], [tabindex="0"]';
    const elements = [...document.querySelectorAll(selector)];
    const violations = [];

    for (const el of elements) {
      // 忽略不可見元素
      if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // 段落內之一般 inline 連結依 WCAG 2.5.8 排除
      if (el.tagName === 'A' && el.closest('p')) continue;

      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      const isPrimary = el.dataset.primary !== undefined || el.classList.contains('btn-primary');
      const minSize = isTouch ? (isPrimary ? 48 : 44) : (isPrimary ? 36 : 32);

      if (rect.width < minSize - 1 || rect.height < minSize - 1) {
        violations.push({
          tag: el.tagName,
          text: (el.textContent || el.value || el.name || '').slice(0, 30).trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          expected: minSize,
        });
      }
    }

    return violations;
  });
}

export async function injectSafeArea(page, { top = 62, bottom = 34, left = 0, right = 0 } = {}) {
  await page.addStyleTag({
    content: `
      :root {
        --safe-top: ${top}px !important;
        --safe-bottom: ${bottom}px !important;
        --safe-left: ${left}px !important;
        --safe-right: ${right}px !important;
      }
    `,
  });
}
