import { Card, ScrollArea } from '../../src'
import { Copy, DemoPage, Section } from '../layout'

const example = `import { Card, DynamicBackground } from '@systant/prism'

export function Page() {
  return (
    <DynamicBackground scene="forest" rain={raining} time={sliderMinutes} style={{ minHeight: '100vh' }}>
      <Card>Hello</Card>
    </DynamicBackground>
  )
}`

export function DynamicBackgroundPage() {
  return (
    <DemoPage
      name="DynamicBackground"
      intro={
        <>
          <p style={{ marginTop: 0 }}>
            An animated landscape behind the whole page, drawn on the GPU: a forest or an ocean under the sky as it
            really is for the time and place, with the sun, the moon, the stars and the Milky Way, drifting clouds and,
            if you ask for it, rain. It follows the local time of day unless you give it a time, and all the glass
            inside it refracts the scene as it moves.
          </p>
          <p>
            It is a <code>GlassBackdrop</code> with its scenes built in. It also comes with a still picture of each
            scene by day and by night, which it shows wherever the browser can't draw the scene, and with the page's
            text colours for those pictures already worked out. This demo is inside one: the cog beside the title
            changes its props.
          </p>
        </>
      }
      demos={
        <>
          <Section title="Usage">
            {/* As wide as the code, spanning every column; on a narrow page the code scrolls sideways inside the card */}
            <Card padding="none" style={{ gridColumn: '1 / -1', justifySelf: 'start', maxWidth: '100%', minWidth: 0 }}>
              <ScrollArea axis="x">
                <pre style={{ margin: 0, padding: 20, width: 'fit-content' }}>
                  <code>{example}</code>
                </pre>
              </ScrollArea>
            </Card>
          </Section>
          <Section title="What it does">
            <Card>
              <Copy title="Time of day">
                Leave <code>time</code> out and the sky follows the local clock. Give it a <code>Date</code>, or a
                number of minutes past midnight (from a slider, for example), and the sky goes straight to that time.
                Take it away again and the sky catches up with the present over a few seconds.
              </Copy>
            </Card>
            <Card>
              <Copy title="Animations">
                <code>animated={'{false}'}</code> eases the scene to a stop and holds it still, redrawing it once a
                minute so the sky keeps up with the time. Left out, it follows <code>prefers-reduced-motion</code>.
              </Copy>
            </Card>
            <Card>
              <Copy title="Rain">
                <code>rain</code> clouds the sky over and starts the rain, over a few seconds. Turning it off clears the
                sky again.
              </Copy>
            </Card>
            <Card>
              <Copy title="Where in the world">
                Sunrise, sunset and the night sky are worked out for a place guessed from the browser's time zone, or
                exactly for a <code>latitude</code> and <code>longitude</code> you give it.
              </Copy>
            </Card>
          </Section>
        </>
      }
      props={[
        ['scene', "'forest' | 'ocean'", "'ocean'", 'Which scene to show. A new one crossfades in over the last.'],
        [
          'animated',
          'boolean',
          '',
          'Whether the scene moves or holds still; it eases between the two. Left out, it follows prefers-reduced-motion.',
        ],
        ['rain', 'boolean', 'false', 'Whether it rains. Rain starts and clears over a few seconds.'],
        [
          'time',
          'Date | number | null',
          '',
          'The time of day to show: a Date, or minutes past midnight today. Left out or null, it follows the local time.',
        ],
        [
          'latitude',
          'number',
          '',
          "The viewer's latitude in degrees, for sunrise, sunset and the stars. Give it together with longitude.",
        ],
        ['longitude', 'number', '', "The viewer's longitude in degrees, positive to the east of Greenwich."],
        [
          'src',
          'string',
          '',
          'A daytime picture to show where the scene cannot be drawn, in place of the built-in one.',
        ],
        ['nightSrc', 'string', '', 'The same, for the night.'],
        [
          '',
          '',
          '',
          'Every other GlassBackdrop prop (waitForScene, loadingLabel, initialNight) and native <div> prop, ref included.',
        ],
      ]}
      customProperties={[
        [
          '--prism-fade-background-duration',
          '450ms',
          'How long a new scene takes to crossfade in over the last, as with a GlassBackdrop.',
        ],
      ]}
    />
  )
}
