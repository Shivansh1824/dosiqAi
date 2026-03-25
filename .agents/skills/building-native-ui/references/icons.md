# Icons (SF Symbols)

Use SF Symbols for a native iOS feel. **SF Symbols are iOS-only** — always provide an Android fallback using `@expo/vector-icons` (Feather). Never use FontAwesome or Ionicons.

## Cross-Platform Pattern (Required)

Use `expo-image` with `source="sf:name"` on iOS and `Feather` from `@expo/vector-icons` on Android:

```tsx
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

{process.env.EXPO_OS === 'ios' ? (
  <Image
    source="sf:magnifyingglass"
    style={{ width: 20, height: 20 }}
    tintColor={color}
  />
) : (
  <Feather name="search" size={20} color={color} />
)}
```

> **Never** use bare `sf:` sources without a platform guard — on Android `expo-image` silently renders nothing for `sf:` URIs.

## iOS-only Usage (when Android rendering the icon doesn't matter)

```tsx
import { Image } from 'expo-image';

<Image
  source="sf:square.and.arrow.down"
  style={{ width: 16, height: 16 }}
  tintColor={color}
/>
```

## Common Icons

### Navigation & Actions
- `house.fill` - home
- `gear` - settings
- `magnifyingglass` - search
- `plus` - add
- `xmark` - close
- `chevron.left` - back
- `chevron.right` - forward
- `arrow.left` - back arrow
- `arrow.right` - forward arrow

### Media
- `play.fill` - play
- `pause.fill` - pause
- `stop.fill` - stop
- `backward.fill` - rewind
- `forward.fill` - fast forward
- `speaker.wave.2.fill` - volume
- `speaker.slash.fill` - mute

### Camera
- `camera` - camera
- `camera.fill` - camera filled
- `arrow.triangle.2.circlepath` - flip camera
- `photo` - gallery/photos
- `bolt` - flash
- `bolt.slash` - flash off

### Communication
- `message` - message
- `message.fill` - message filled
- `envelope` - email
- `envelope.fill` - email filled
- `phone` - phone
- `phone.fill` - phone filled
- `video` - video call
- `video.fill` - video call filled

### Social
- `heart` - like
- `heart.fill` - liked
- `star` - favorite
- `star.fill` - favorited
- `hand.thumbsup` - thumbs up
- `hand.thumbsdown` - thumbs down
- `person` - profile
- `person.fill` - profile filled
- `person.2` - people
- `person.2.fill` - people filled

### Content Actions
- `square.and.arrow.up` - share
- `square.and.arrow.down` - download
- `doc.on.doc` - copy
- `trash` - delete
- `pencil` - edit
- `folder` - folder
- `folder.fill` - folder filled
- `bookmark` - bookmark
- `bookmark.fill` - bookmarked

### Status & Feedback
- `checkmark` - success/done
- `checkmark.circle.fill` - completed
- `xmark.circle.fill` - error/failed
- `exclamationmark.triangle` - warning
- `info.circle` - info
- `questionmark.circle` - help
- `bell` - notification
- `bell.fill` - notification filled

### Misc
- `ellipsis` - more options
- `ellipsis.circle` - more in circle
- `line.3.horizontal` - menu/hamburger
- `slider.horizontal.3` - filters
- `arrow.clockwise` - refresh
- `location` - location
- `location.fill` - location filled
- `map` - map
- `mappin` - pin
- `clock` - time
- `calendar` - calendar
- `link` - link
- `nosign` - block/prohibited

## Animated Symbols

```tsx
<SymbolView
  name="checkmark.circle"
  animationSpec={{
    effect: {
      type: "bounce",
      direction: "up",
    },
  }}
/>
```

### Animation Effects

- `bounce` - Bouncy animation
- `pulse` - Pulsing effect
- `variableColor` - Color cycling
- `scale` - Scale animation

```tsx
// Bounce with direction
animationSpec={{
  effect: { type: "bounce", direction: "up" }  // up | down
}}

// Pulse
animationSpec={{
  effect: { type: "pulse" }
}}

// Variable color (multicolor symbols)
animationSpec={{
  effect: {
    type: "variableColor",
    cumulative: true,
    reversing: true
  }
}}
```

## Symbol Weights

```tsx
// Lighter weights
<SymbolView name="star" weight="ultraLight" />
<SymbolView name="star" weight="thin" />
<SymbolView name="star" weight="light" />

// Default
<SymbolView name="star" weight="regular" />

// Heavier weights
<SymbolView name="star" weight="medium" />
<SymbolView name="star" weight="semibold" />
<SymbolView name="star" weight="bold" />
<SymbolView name="star" weight="heavy" />
<SymbolView name="star" weight="black" />
```

## Symbol Scales

```tsx
<SymbolView name="star" scale="small" />
<SymbolView name="star" scale="medium" />  // default
<SymbolView name="star" scale="large" />
```

## Multicolor Symbols

Some symbols support multiple colors:

```tsx
<SymbolView
  name="cloud.sun.rain.fill"
  type="multicolor"
/>
```

## Finding Symbol Names

1. Use the SF Symbols app on macOS (free from Apple)
2. Search at https://developer.apple.com/sf-symbols/
3. Symbol names use dot notation: `square.and.arrow.up`

## Best Practices

- Always use SF Symbols on iOS — wrap in `process.env.EXPO_OS === 'ios'` with a Feather fallback for Android
- Match symbol weight to nearby text weight
- Use `.fill` variants for selected/active states
- Use PlatformColor for tint to support dark mode
- Keep icons at consistent sizes (16, 20, 24, 32)
