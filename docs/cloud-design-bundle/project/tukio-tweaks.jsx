/* Tweaks panel — palette, density, hero variant */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  palette: 'terracotta',
  density: 'regular',
  heroVariant: 'editorial',
  fraunces: 'Fraunces',
  showLogos: true,
  showSystem: true,
  showMVP: true,
  showV1: true,
  showV2: true,
  showV3: true,
}; /*EDITMODE-END*/

const PALETTES = {
  terracotta: {
    '--brand-50': '#FCF3EE',
    '--brand-100': '#F8E0D0',
    '--brand-200': '#F1B996',
    '--brand-300': '#E89160',
    '--brand-400': '#DC6E33',
    '--brand-500': '#C2410C',
    '--brand-600': '#9A340A',
    '--brand-700': '#7A2A09',
    '--brand-800': '#5C2008',
    '--brand-900': '#3E1606',
  },
  ocre: {
    '--brand-50': '#FBF5E5',
    '--brand-100': '#F5E5B8',
    '--brand-200': '#E9CD7A',
    '--brand-300': '#D9AE3F',
    '--brand-400': '#BC8E1F',
    '--brand-500': '#946C13',
    '--brand-600': '#75550E',
    '--brand-700': '#5A410B',
    '--brand-800': '#3F2D08',
    '--brand-900': '#2A1E05',
  },
  emeraude: {
    '--brand-50': '#ECF4EF',
    '--brand-100': '#C9E0D2',
    '--brand-200': '#8EC2A2',
    '--brand-300': '#5BA078',
    '--brand-400': '#3D7F5A',
    '--brand-500': '#2A6042',
    '--brand-600': '#1F4B33',
    '--brand-700': '#173B28',
    '--brand-800': '#102A1C',
    '--brand-900': '#091B11',
  },
  bleu: {
    '--brand-50': '#EEF2F8',
    '--brand-100': '#CBD7EA',
    '--brand-200': '#92ACD0',
    '--brand-300': '#5C81B3',
    '--brand-400': '#3A5F95',
    '--brand-500': '#27457A',
    '--brand-600': '#1D3460',
    '--brand-700': '#16284A',
    '--brand-800': '#0F1B33',
    '--brand-900': '#080F1D',
  },
};

function applyTweaks(t) {
  const r = document.documentElement;
  // palette
  const p = PALETTES[t.palette] || PALETTES.terracotta;
  for (const k in p) r.style.setProperty(k, p[k]);
  // density (compact -16%, regular default, comfy +16% on body sizing)
  const dens = { compact: 0.92, regular: 1.0, comfy: 1.08 }[t.density] || 1.0;
  r.style.setProperty('--tk-density', dens);
  // font swap
  r.style.setProperty('--font-display', `'${t.fraunces}', 'Fraunces', Georgia, serif`);
}

function TukioTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => {
    applyTweaks(t);
  }, [t]);

  return (
    <TweaksPanel title="Tweaks · tukio.one">
      <TweakSection label="Palette de marque" />
      <TweakSelect
        label="Couleur principale"
        value={t.palette}
        options={[
          { value: 'terracotta', label: 'Terracotta (brief)' },
          { value: 'ocre', label: 'Ocre · doré' },
          { value: 'emeraude', label: 'Émeraude · forêt' },
          { value: 'bleu', label: 'Bleu · marin' },
        ]}
        onChange={(v) => setTweak('palette', v)}
      />

      <TweakSection label="Typographie" />
      <TweakSelect
        label="Display serif"
        value={t.fraunces}
        options={[
          { value: 'Fraunces', label: 'Fraunces (brief)' },
          { value: 'Playfair Display', label: 'Playfair Display' },
          { value: 'DM Serif Display', label: 'DM Serif Display' },
          { value: 'Cormorant Garamond', label: 'Cormorant' },
          { value: 'EB Garamond', label: 'EB Garamond' },
        ]}
        onChange={(v) => setTweak('fraunces', v)}
      />

      <TweakSection label="Mise en page" />
      <TweakRadio
        label="Densité"
        value={t.density}
        options={['compact', 'regular', 'comfy']}
        onChange={(v) => setTweak('density', v)}
      />
      <TweakRadio
        label="Hero homepage"
        value={t.heroVariant}
        options={['editorial', 'split', 'minimal']}
        onChange={(v) => setTweak('heroVariant', v)}
      />

      <TweakSection label="Versions visibles" />
      <TweakToggle
        label="MVP · transaction"
        value={t.showMVP}
        onChange={(v) => setTweak('showMVP', v)}
      />
      <TweakToggle
        label="V1 · marketplace"
        value={t.showV1}
        onChange={(v) => setTweak('showV1', v)}
      />
      <TweakToggle
        label="V2 · croissance"
        value={t.showV2}
        onChange={(v) => setTweak('showV2', v)}
      />
      <TweakToggle
        label="V3 · scale & expansion"
        value={t.showV3}
        onChange={(v) => setTweak('showV3', v)}
      />

      <TweakSection label="Fondations" />
      <TweakToggle
        label="Logo · 3 directions"
        value={t.showLogos}
        onChange={(v) => setTweak('showLogos', v)}
      />
      <TweakToggle
        label="Système de design"
        value={t.showSystem}
        onChange={(v) => setTweak('showSystem', v)}
      />
    </TweaksPanel>
  );
}

window.TukioTweaks = TukioTweaks;
window.__getTweakDefaults = () => TWEAK_DEFAULTS;
