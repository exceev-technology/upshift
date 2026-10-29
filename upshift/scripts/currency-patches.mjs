// Tabler's IconCurrencyDirham draws the UAE sign and there is no Moroccan one, so MAD shows its code
export const CURRENCY_PATCHES = [
  {
    file: 'packages/twenty-front/src/modules/ui/input/components/internal/currency/constants/CurrencyCodeIcons.ts',
    replacements: [
      {
        from: 'export const CURRENCY_CODE_ICONS: Record<CurrencyCode, IconComponent> = {',
        to: [
          "import { createElement } from 'react';",
          '',
          'const IconCurrencyMoroccanDirham: IconComponent = ({',
          '  className,',
          '  style,',
          '  color,',
          '}) =>',
          '  createElement(',
          "    'span',",
          '    { className, style: { ...style, color: color ?? style?.color } },',
          "    'MAD',",
          '  );',
          '',
          'export const CURRENCY_CODE_ICONS: Record<CurrencyCode, IconComponent> = {',
        ].join('\n'),
      },
      {
        from: '  MAD: IconCurrencyDirham,\n',
        to: '  MAD: IconCurrencyMoroccanDirham,\n',
      },
    ],
  },
];
