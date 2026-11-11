import { Card, type CardPadding } from '../../src'
import { Copy, DemoPage, Section } from '../layout'

const paddings: CardPadding[] = ['none', 'sm', 'md', 'lg']

export function CardPage() {
  return (
    <DemoPage
      name="Card"
      intro={
        <p style={{ marginTop: 0 }}>
          A card is a panel of translucent glass: it lightly blurs what is behind it and bends it at the edges. Move the
          pointer around: the borders of the cards near it light up, and the card under it shows a sheen inside the
          edges nearest the pointer.
        </p>
      }
      demos={
        <>
          <Section title="Glass">
            <Card>
              <Copy title="Default">Tinted glass with a hairline border and a soft shadow.</Copy>
            </Card>
            <Card style={{ '--prism-refraction': '40%' }}>
              <Copy title="Stronger refraction">
                <code>--prism-refraction</code> sets how strongly the edges bend what is behind them.
              </Copy>
            </Card>
          </Section>

          <Section title="Padding">
            {paddings.map((padding) => (
              <Card key={padding} padding={padding} style={{ overflow: 'hidden', alignSelf: 'start' }}>
                {/* The tinted block shows where the card's content begins */}
                <div style={{ background: 'rgb(109 124 255 / 0.15)', padding: 12 }}>
                  <code>padding="{padding}"</code>
                </div>
              </Card>
            ))}
          </Section>

          <Section title="Customising">
            <Card highlight={false}>
              <Copy title="No highlight">
                <code>highlight={'{false}'}</code> stops the border lighting up near the pointer.
              </Copy>
            </Card>
            <Card innerSheen={false}>
              <Copy title="No inner sheen">
                <code>innerSheen={'{false}'}</code> turns the hover sheen off.
              </Copy>
            </Card>
            <Card style={{ '--prism-inner-sheen-color': '#ffd27a', '--prism-inner-sheen-intensity': 0.4 }}>
              <Copy title="Inner sheen tuning">
                {' '}
                Set with <code>--prism-inner-sheen-color</code>, <code>--prism-inner-sheen-intensity</code>,{' '}
                <code>--prism-inner-sheen-size</code> and <code>--prism-inner-sheen-width</code>.
              </Copy>
            </Card>
            <Card style={{ '--prism-card-highlight': '#ff6b6b' }}>
              <Copy title="Highlight colour">
                Set with <code>--prism-card-highlight</code>.
              </Copy>
            </Card>
            <Card style={{ '--prism-card-highlight-size': '10rem' }}>
              <Copy title="Highlight size">
                Set with <code>--prism-card-highlight-size</code>, in any length unit.
              </Copy>
            </Card>
            <Card padding="lg" style={{ '--prism-card-radius': '28px' }}>
              <Copy title="Custom radius">
                Set with <code>--prism-card-radius</code>.
              </Copy>
            </Card>
          </Section>
        </>
      }
      props={[
        ['padding', "'none' | 'sm' | 'md' | 'lg'", "'md'", '0, 12, 20 or 32px.'],
        ['highlight', 'boolean', 'true', 'Lights up the border near the pointer.'],
        [
          'innerSheen',
          'boolean',
          'true',
          'Shows a sheen inside the edges nearest the pointer while the card is hovered.',
        ],
        ['refract', 'boolean', 'true', 'Blurs what is behind the card and bends it at the edges.'],
        ['', '', '', 'Every other native <div> prop, ref included.'],
      ]}
      customProperties={[
        ['--prism-card-bg', '#f3f4f6', 'Colour of the glass tint (#24272e in dark mode).'],
        ['--prism-card-fg', '#111318', 'Text colour (#eceef2 in dark mode).'],
        ['--prism-card-glass-opacity', '0.3', 'Opacity of the tint.'],
        ['--prism-card-border', '', 'Colour of the hairline border.'],
        ['--prism-card-radius', '16px', 'Corner radius, shared with buttons.'],
        ['--prism-card-highlight', '#ffffff', 'Colour of the pointer light on the border.'],
        ['--prism-card-highlight-size', '', 'Reach of the pointer light, in any length unit.'],
        ['--prism-refraction', '', 'How strongly the edges bend what is behind.'],
        ['--prism-inner-sheen-color', '', 'Colour of the hover sheen.'],
        ['--prism-inner-sheen-intensity', '0.4', 'Strength of the hover sheen (0.22 in dark mode).'],
        ['--prism-inner-sheen-size', '', 'Reach of the hover sheen.'],
        ['--prism-inner-sheen-width', '', 'Width of the hover sheen along the edge.'],
        [
          '--prism-card-stripe-strength',
          '1',
          'Strength of the reflected streaks; 0 turns them off (0.6 in dark mode).',
        ],
      ]}
    />
  )
}
