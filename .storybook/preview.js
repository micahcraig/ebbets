import '../src/index.css'

/** @type {import('@storybook/react').Preview} */
const preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
}
export default preview
