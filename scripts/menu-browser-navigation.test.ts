import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { clearSearchIntent } from "../src/lib/menu-engagement/navigation-intent";

const browser = readFileSync(join(process.cwd(), "src", "app", "r", "[slug]", "MenuBrowser.tsx"), "utf8");

test("menu section controls are bookmarks and never filter the published menu", () => {
  assert.doesNotMatch(browser, /selectedCategory|setSelectedCategory|Full Menu/);
  assert.match(browser, /const visibleSections = useMemo\(\(\) => menuSections\s*\.map\(/);
  assert.match(browser, /if \(!search\) return true/);
  assert.match(browser, /onClick=\{\(\) => navigateToSection\(section\)\}/);
  assert.match(browser, /function navigateToSection\(section: MenuSection, fromSectionList = false\)/);
  assert.match(browser, /requestAnimationFrame\(\(\) => scrollToSection\(section\.id, behavior\)\)/);
  assert.match(browser, /function selectSectionFromList\(section: MenuSection\)\s*\{\s*navigateToSection\(section, true\);/);
  assert.match(browser, /if \(targetSectionId\)[\s\S]*?scrollToSection\(targetSectionId, behavior\)/);
  assert.deepEqual(clearSearchIntent("requested-section"), { kind: "section", sectionId: "requested-section" });
  assert.match(browser, /if \(intent\.kind === "section"\)[\s\S]*?visibleSections\.some\(\(section\) => section\.id === intent\.sectionId\)[\s\S]*?scrollToSection\(intent\.sectionId, behavior\)/);
  assert.match(browser, /setSearchInput\(""\);\s*setSearch\(""\)/);
  assert.match(browser, /if \(visibleSections\.some\(\(section\) => section\.id === intent\.sectionId\)\) scrollToSection/);
});

test("active section remains scroll-derived and menu search remains the only filter", () => {
  assert.match(browser, /const activeCategory = visibleCategory/);
  assert.match(browser, /for \(const section of visibleSections\)[\s\S]*?setVisibleCategory\(current\)/);
  assert.match(browser, /const showResultCount = Boolean\(search\)/);
  assert.match(browser, /item\.name, item\.description \|\| ""/);
  assert.match(browser, /sectionIdForHash/);
  assert.match(browser, /window\.addEventListener\("hashchange", scrollHashTarget\)/);
  assert.match(browser, /navigationIntentRef\.current = nextSearch \? searchIntent\(\) : clearSearchIntent\(\)/);
  assert.match(browser, /menuResultsRef\.current\?\.scrollIntoView\(\{ block: "start", behavior \}\)/);
});
