import { useState, useEffect, useCallback } from 'react';
import type { LocalFileRefreshMode } from '../viewer/store';

type ThemeMode = 'light' | 'dark' | 'system';
type ContentAlignment = 'left' | 'center';

interface Settings {
  theme: ThemeMode;
  fontSize: number;
  tocFontSize: number;
  tocSmoothScrollEnabled: boolean;
  sidebarDividerVisible: boolean;
  contentAlignment: ContentAlignment;
  localFileRefreshMode: LocalFileRefreshMode;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 15,
  tocFontSize: 13,
  tocSmoothScrollEnabled: true,
  sidebarDividerVisible: true,
  contentAlignment: 'center',
  localFileRefreshMode: 'prompt',
};

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const TOC_FONT_SIZE_MIN = 12;
const TOC_FONT_SIZE_MAX = 20;

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get('viewerSettings');
        const stored = result['viewerSettings'] as Partial<Settings> | undefined;
        if (stored) {
          setSettings({
            theme: stored.theme ?? DEFAULT_SETTINGS.theme,
            fontSize: stored.fontSize ?? DEFAULT_SETTINGS.fontSize,
            tocFontSize: Math.min(
              TOC_FONT_SIZE_MAX,
              Math.max(TOC_FONT_SIZE_MIN, stored.tocFontSize ?? DEFAULT_SETTINGS.tocFontSize),
            ),
            tocSmoothScrollEnabled:
              stored.tocSmoothScrollEnabled ?? DEFAULT_SETTINGS.tocSmoothScrollEnabled,
            sidebarDividerVisible:
              stored.sidebarDividerVisible ?? DEFAULT_SETTINGS.sidebarDividerVisible,
            contentAlignment: stored.contentAlignment === 'left' ? 'left' : 'center',
            localFileRefreshMode: stored.localFileRefreshMode === 'auto' ? 'auto' : 'prompt',
          });
        }
      }
    } catch {
      // Storage may not be available
    }
  }

  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ viewerSettings: newSettings });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Storage may not be available
    }
  }, []);

  const handleThemeChange = useCallback(
    (theme: ThemeMode) => {
      const newSettings = { ...settings, theme };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  const handleFontSizeChange = useCallback(
    (fontSize: number) => {
      const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize));
      const newSettings = { ...settings, fontSize: clamped };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  const handleTocFontSizeChange = useCallback(
    (tocFontSize: number) => {
      const clamped = Math.min(TOC_FONT_SIZE_MAX, Math.max(TOC_FONT_SIZE_MIN, tocFontSize));
      const newSettings = { ...settings, tocFontSize: clamped };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  const handleTocSmoothScrollChange = useCallback(
    (tocSmoothScrollEnabled: boolean) => {
      const newSettings = { ...settings, tocSmoothScrollEnabled };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  const handleContentAlignmentChange = useCallback(
    (contentAlignment: ContentAlignment) => {
      const newSettings = { ...settings, contentAlignment };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  const handleSidebarDividerChange = useCallback(
    (sidebarDividerVisible: boolean) => {
      const newSettings = { ...settings, sidebarDividerVisible };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  const handleLocalFileRefreshModeChange = useCallback(
    (localFileRefreshMode: LocalFileRefreshMode) => {
      const newSettings = { ...settings, localFileRefreshMode };
      setSettings(newSettings);
      void saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Feishu MD Viewer Settings</h1>

        {saved && (
          <div style={styles.savedBanner} role="status" aria-live="polite">
            Settings saved
          </div>
        )}

        {/* Theme selector */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Theme</h2>
          <p style={styles.description}>Choose the visual theme for the viewer.</p>
          <div style={styles.radioGroup} role="radiogroup" aria-label="Theme selection">
            {(['system', 'light', 'dark'] as ThemeMode[]).map((themeOption) => (
              <label key={themeOption} style={styles.radioLabel}>
                <input
                  type="radio"
                  name="theme"
                  value={themeOption}
                  checked={settings.theme === themeOption}
                  onChange={() => handleThemeChange(themeOption)}
                  style={styles.radioInput}
                />
                <span style={styles.radioText}>
                  {themeOption === 'system'
                    ? 'System (auto)'
                    : themeOption === 'light'
                      ? 'Light'
                      : 'Dark'}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Font size */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Font Size</h2>
          <p style={styles.description}>
            Adjust the base font size for document content ({FONT_SIZE_MIN}px - {FONT_SIZE_MAX}px).
          </p>
          <div style={styles.fontSizeControl}>
            <button
              style={styles.fontBtn}
              onClick={() => handleFontSizeChange(settings.fontSize - 1)}
              disabled={settings.fontSize <= FONT_SIZE_MIN}
              type="button"
              aria-label="Decrease font size"
            >
              -
            </button>
            <span style={styles.fontSizeDisplay} aria-live="polite" aria-atomic="true">
              {settings.fontSize}px
            </span>
            <button
              style={styles.fontBtn}
              onClick={() => handleFontSizeChange(settings.fontSize + 1)}
              disabled={settings.fontSize >= FONT_SIZE_MAX}
              type="button"
              aria-label="Increase font size"
            >
              +
            </button>
            <input
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              value={settings.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              style={styles.slider}
              aria-label="Font size slider"
            />
          </div>
        </section>

        {/* TOC font size */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>目录字号</h2>
          <p style={styles.description}>
            调整左侧目录项目字号（{TOC_FONT_SIZE_MIN}px - {TOC_FONT_SIZE_MAX}px）。
          </p>
          <div style={styles.fontSizeControl}>
            <button
              style={styles.fontBtn}
              onClick={() => handleTocFontSizeChange(settings.tocFontSize - 1)}
              disabled={settings.tocFontSize <= TOC_FONT_SIZE_MIN}
              type="button"
              aria-label="Decrease TOC font size"
            >
              -
            </button>
            <span style={styles.fontSizeDisplay} aria-live="polite" aria-atomic="true">
              {settings.tocFontSize}px
            </span>
            <button
              style={styles.fontBtn}
              onClick={() => handleTocFontSizeChange(settings.tocFontSize + 1)}
              disabled={settings.tocFontSize >= TOC_FONT_SIZE_MAX}
              type="button"
              aria-label="Increase TOC font size"
            >
              +
            </button>
            <input
              type="range"
              min={TOC_FONT_SIZE_MIN}
              max={TOC_FONT_SIZE_MAX}
              step={1}
              value={settings.tocFontSize}
              onChange={(e) => handleTocFontSizeChange(Number(e.target.value))}
              style={styles.slider}
              aria-label="TOC font size slider"
            />
          </div>
        </section>

        {/* TOC scroll behavior */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>TOC Scroll Behavior</h2>
          <p style={styles.description}>
            Choose whether clicking the table of contents uses smooth scrolling.
          </p>
          <div
            style={styles.radioGroup}
            role="radiogroup"
            aria-label="TOC scroll behavior selection"
          >
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="toc-scroll-behavior"
                checked={settings.tocSmoothScrollEnabled}
                onChange={() => handleTocSmoothScrollChange(true)}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>Smooth scroll</span>
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="toc-scroll-behavior"
                checked={!settings.tocSmoothScrollEnabled}
                onChange={() => handleTocSmoothScrollChange(false)}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>Instant jump</span>
            </label>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>正文对齐</h2>
          <p style={styles.description}>选择桌面阅读页中正文栏的默认对齐方式。</p>
          <div style={styles.radioGroup} role="radiogroup" aria-label="正文对齐">
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="content-alignment"
                checked={settings.contentAlignment === 'center'}
                onChange={() => handleContentAlignmentChange('center')}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>正文居中</span>
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="content-alignment"
                checked={settings.contentAlignment === 'left'}
                onChange={() => handleContentAlignmentChange('left')}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>正文靠左</span>
            </label>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>目录分隔线</h2>
          <p style={styles.description}>
            控制目录与正文之间的分隔线。隐藏后仍可将鼠标移到目录右侧边缘拖动调整宽度。
          </p>
          <div style={styles.radioGroup} role="radiogroup" aria-label="目录分隔线">
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="sidebar-divider"
                checked={settings.sidebarDividerVisible}
                onChange={() => handleSidebarDividerChange(true)}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>显示目录分隔线</span>
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="sidebar-divider"
                checked={!settings.sidebarDividerVisible}
                onChange={() => handleSidebarDividerChange(false)}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>隐藏目录分隔线</span>
            </label>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>本地文件更新</h2>
          <p style={styles.description}>选择浏览器打开本地 Markdown 文件发生变化时的处理方式。</p>
          <div style={styles.radioGroup} role="radiogroup" aria-label="本地文件更新方式">
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="local-file-refresh-mode"
                checked={settings.localFileRefreshMode === 'prompt'}
                onChange={() => handleLocalFileRefreshModeChange('prompt')}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>提示后手动刷新</span>
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="local-file-refresh-mode"
                checked={settings.localFileRefreshMode === 'auto'}
                onChange={() => handleLocalFileRefreshModeChange('auto')}
                style={styles.radioInput}
              />
              <span style={styles.radioText}>自动刷新</span>
            </label>
          </div>
        </section>

        <footer style={styles.footer}>
          <p style={styles.footerText}>Feishu MD Viewer v0.1.0</p>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '24px',
    color: '#1f2329',
  },
  savedBanner: {
    background: '#e8f5e8',
    color: '#2e7d32',
    padding: '8px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: '500',
  },
  section: {
    marginBottom: '28px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e5e6eb',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#1f2329',
  },
  description: {
    fontSize: '13px',
    color: '#646a73',
    marginBottom: '12px',
  },
  radioGroup: {
    display: 'flex',
    gap: '16px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  radioInput: {
    marginRight: '6px',
  },
  radioText: {
    fontSize: '14px',
    color: '#1f2329',
  },
  fontSizeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fontBtn: {
    width: '32px',
    height: '32px',
    border: '1px solid #dee0e3',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1f2329',
  },
  fontSizeDisplay: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '40px',
    textAlign: 'center' as const,
  },
  slider: {
    flex: 1,
    height: '4px',
    marginLeft: '12px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  checkbox: {
    marginRight: '8px',
    width: '16px',
    height: '16px',
  },
  toggleText: {
    fontSize: '14px',
    color: '#1f2329',
  },
  footer: {
    marginTop: '16px',
    paddingTop: '16px',
  },
  footerText: {
    fontSize: '12px',
    color: '#8f959e',
  },
};
