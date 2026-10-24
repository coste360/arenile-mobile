const { checkFile } = require('./style-guard');

const APP = 'src/app/example.tsx';

describe('style guard', () => {
  it.each([
    ['theme utilities', '<View className="bg-primary text-primary-foreground border-border" />'],
    ['opacity modifier on a token', '<View className="bg-primary/90 active:bg-accent" />'],
    ['layout arbitrary value', '<View className="max-w-[32rem] h-[60%]" />'],
    ['status bar colour mode', '<StatusBar style={scheme === "dark" ? "light" : "dark"} />'],
    ['hash in a URL', "const u = 'https://lido.example.it/#top';"],
    ['the theme stylesheet', "import '../global.css';"],
  ])('accepts %s', (_name, source) => {
    expect(checkFile(APP, source)).toEqual([]);
  });

  it.each([
    ['inline style', '<View style={{ padding: 4 }} />', 'style={'],
    ['StyleSheet', 'const s = StyleSheet.create({ a: {} });', 'StyleSheet'],
    ['raw hex colour', "<Icon color='#0b2542' />", 'raw colour'],
    ['colour function', "const c = 'rgba(0,0,0,0.5)';", 'raw colour'],
    ['default palette', '<View className="bg-red-500" />', 'default palette'],
    ['palette white text', '<Text className="text-white" />', 'default palette'],
    [
      'palette with variant and opacity',
      '<View className="dark:bg-black/50" />',
      'default palette',
    ],
    ['arbitrary colour', '<View className="bg-[#fff]" />', 'raw colour'],
    ['arbitrary typography', '<Text className="text-[10px]" />', 'custom typography'],
    ['pixel length', '<View className="w-[2px]" />', 'pixel length'],
    ['arbitrary property', '<View className="[elevation:2]" />', 'arbitrary CSS property'],
    ['custom property', '<View className="[--x:1]" />', 'custom property'],
    ['CSS-in-JS', "import styled from 'styled-components';", 'CSS-in-JS'],
    ['other stylesheet import', "import './extra.css';", 'stylesheet import'],
  ])('rejects %s', (_name, source, message) => {
    const errors = checkFile(APP, source);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(message);
  });

  it('rejects stylesheets other than src/global.css', () => {
    expect(checkFile('src/global.css', '')).toEqual([]);
    expect(checkFile('src/extra.css', '')).toHaveLength(1);
  });

  it('lets vendored Reusables components keep what the CLI generates', () => {
    const source = "<View className='h-[1px] shadow-black/5 bg-black/50' />";
    expect(checkFile('src/components/ui/separator.tsx', source)).toEqual([]);
    expect(checkFile('src/components/separator.tsx', source).length).toBeGreaterThan(0);
  });

  it('allows raw colours only in the navigation theme', () => {
    const source = "const c = 'hsl(210 40% 98%)';";
    expect(checkFile('src/lib/theme.ts', source)).toEqual([]);
    expect(checkFile('src/lib/other.ts', source).length).toBeGreaterThan(0);
  });

  it('reports the line of each problem', () => {
    expect(checkFile(APP, 'const a = 1;\n<View style={{}} />')).toEqual([
      `${APP}:2: "style={" not allowed (use className with theme utilities)`,
    ]);
  });
});
