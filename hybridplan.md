# Hybrid Responsive Layout - Future Implementation Plan

## Overview

This document outlines the strategy for applying the hybrid responsive layout approach (developed for HomeScreen stat cards) to the entire FamilyCareHealth mobile app.

## Hybrid Responsive Approach Explained

### Core Concept

The hybrid approach dynamically adapts layout based on available screen width:

**Two Modes:**
1. **Fixed/Flexible Layout** (screens ≥360px available width)
   - Content uses flexbox to fill available width
   - Cards/items resize proportionally
   - No scrolling needed

2. **Horizontal Scroll Layout** (screens <360px available width)
   - Content maintains optimal size (doesn't shrink)
   - Horizontal ScrollView enables access to all content
   - Better readability on small devices

### Implementation Pattern

```typescript
// 1. Import Dimensions
import { Dimensions } from 'react-native';

// 2. Get screen width
const screenWidth = Dimensions.get('window').width;

// 3. Calculate available width
const horizontalPadding = Sizes.lg * 2; // 48px
const availableWidth = screenWidth - horizontalPadding;

// 4. Determine layout mode
const threshold = 360; // Adjust per screen
const useScrollView = availableWidth < threshold;

// 5. Calculate item width
const itemGap = 12;
const itemCount = 3;
const itemWidth = useScrollView
  ? 110 // Fixed width for scroll
  : (availableWidth - (itemCount - 1) * itemGap) / itemCount; // Flexible

// 6. Conditional rendering
{useScrollView ? (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {renderItems()}
  </ScrollView>
) : (
  <View style={{ flexDirection: 'row', gap: itemGap }}>
    {renderItems()}
  </View>
)}
```

## Screens to Enhance (Priority Order)

### Phase 1: High-Traffic Screens (Immediate Impact)

#### 1. DocumentsScreen
**Current**: List of document cards
**Enhancement Needed**:
- If showing documents in grid view, apply hybrid approach
- 2-column grid on large screens, horizontal scroll on small screens
- Estimated effort: 3-4 hours

#### 2. MedicationsScreen
**Current**: List of medication cards with action buttons
**Enhancement Needed**:
- If showing quick stats or categories, apply hybrid
- Full-width list can remain as-is (already scrolls vertically)
- Estimated effort: 2-3 hours

#### 3. AppointmentsScreen (When Created)
**Current**: Not yet implemented
**Enhancement Needed**:
- Apply hybrid from start for calendar month view or quick filters
- Week view with horizontal scroll on small screens
- Estimated effort: 4-5 hours (includes screen creation)

#### 4. HealthScreen
**Current**: Health metrics and vitals
**Enhancement Needed**:
- Vital cards (blood pressure, heart rate, etc.) in hybrid layout
- 2-3 cards per row on large screens, scroll on small
- Estimated effort: 3-4 hours

### Phase 2: Secondary Screens (User Experience Polish)

#### 5. ProfileScreen
**Current**: User profile and settings
**Enhancement Needed**:
- Quick action buttons (edit profile, settings, logout) in hybrid row
- Account stats (documents uploaded, appointments scheduled) in cards
- Estimated effort: 2-3 hours

#### 6. DocumentDetailScreen
**Current**: Single document view with health metrics
**Enhancement Needed**:
- Extracted vitals/metrics in card grid with hybrid layout
- Findings cards in horizontal scroll
- Estimated effort: 3-4 hours

#### 7. ScanDocumentScreen
**Current**: Camera view and document capture
**Enhancement Needed**:
- Action buttons (capture, retake, use photo) in hybrid row
- Recent scans thumbnails in horizontal scroll
- Estimated effort: 2-3 hours

### Phase 3: Onboarding & Auth (Consistency)

#### 8. WelcomeScreen, OnboardingScreen, LoginScreen, SignupScreen
**Current**: Vertical layouts
**Enhancement Needed**:
- Feature cards in onboarding with hybrid layout
- Login/signup social auth buttons in responsive row
- Estimated effort: 4-5 hours total

## Design System Updates Needed

### 1. Create Reusable Hybrid Layout Hook

**File**: `mobile/src/hooks/useHybridLayout.ts`

```typescript
import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

interface HybridLayoutConfig {
  itemCount: number;
  itemGap?: number;
  threshold?: number;
  scrollItemWidth?: number;
}

interface HybridLayoutResult {
  useScrollView: boolean;
  itemWidth: number;
  availableWidth: number;
}

export const useHybridLayout = ({
  itemCount,
  itemGap = 12,
  threshold = 360,
  scrollItemWidth = 110,
}: HybridLayoutConfig): HybridLayoutResult => {
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get('window').width
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

  const horizontalPadding = 48; // Sizes.lg * 2
  const availableWidth = screenWidth - horizontalPadding;
  const useScrollView = availableWidth < threshold;

  const itemWidth = useScrollView
    ? scrollItemWidth
    : (availableWidth - (itemCount - 1) * itemGap) / itemCount;

  return {
    useScrollView,
    itemWidth,
    availableWidth,
  };
};
```

### 2. Create Reusable Hybrid Container Component

**File**: `mobile/src/components/HybridContainer.tsx`

```typescript
import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useHybridLayout } from '../hooks/useHybridLayout';

interface HybridContainerProps {
  itemCount: number;
  gap?: number;
  threshold?: number;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const HybridContainer: React.FC<HybridContainerProps> = ({
  itemCount,
  gap = 12,
  threshold = 360,
  children,
  containerStyle,
}) => {
  const { useScrollView } = useHybridLayout({ itemCount, itemGap: gap, threshold });

  if (useScrollView) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { gap }, containerStyle]}
        style={styles.scrollView}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.fixedContainer, { gap }, containerStyle]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingRight: 24,
  },
  fixedContainer: {
    flexDirection: 'row',
  },
});
```

### 3. Update Design Constants

**File**: `mobile/src/constants/Sizes.ts`

Add responsive breakpoints:

```typescript
export const Breakpoints = {
  small: 360,   // Hybrid threshold
  medium: 375,  // iPhone SE
  large: 414,   // iPhone Pro
  xlarge: 428,  // iPhone Pro Max
};
```

## Testing Strategy

### Device Testing Matrix

Test hybrid layouts on:
- ✅ iPhone SE (375px) - Small screen, scroll mode
- ✅ iPhone 16 (393px) - Medium screen, flex mode
- ✅ iPhone 16 Pro Max (430px) - Large screen, flex mode
- ✅ Android Small (360px) - Borderline, scroll mode
- ✅ Android Medium (412px) - Standard, flex mode

### Automated Testing

Create snapshot tests for both modes:

```typescript
describe('HybridContainer', () => {
  it('renders fixed layout on large screens', () => {
    mockDimensions(430);
    const tree = renderer.create(<HybridContainer itemCount={3}>...</HybridContainer>);
    expect(tree).toMatchSnapshot();
  });

  it('renders scroll layout on small screens', () => {
    mockDimensions(360);
    const tree = renderer.create(<HybridContainer itemCount={3}>...</HybridContainer>);
    expect(tree).toMatchSnapshot();
  });
});
```

### Visual Regression Testing

Use detox or maestro for E2E tests:
1. Navigate to screen
2. Capture screenshot on multiple device sizes
3. Compare against baseline

## Performance Considerations

### Optimization 1: Memoize Layout Calculations

```typescript
const layoutConfig = useMemo(
  () => ({ itemCount: 3, itemGap: 12, threshold: 360 }),
  []
);
const { useScrollView, itemWidth } = useHybridLayout(layoutConfig);
```

### Optimization 2: Avoid Re-renders on Rotation

Only recalculate when dimensions actually change:

```typescript
const [dimensions, setDimensions] = useState(Dimensions.get('window'));

useEffect(() => {
  const handler = ({ window }: { window: ScaledSize }) => {
    setDimensions(prev => {
      if (prev.width === window.width) return prev;
      return window;
    });
  };

  const subscription = Dimensions.addEventListener('change', handler);
  return () => subscription?.remove();
}, []);
```

### Optimization 3: Lazy Loading for ScrollView

For long horizontal lists:

```typescript
<FlatList
  horizontal
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  initialNumToRender={5}
  maxToRenderPerBatch={3}
  windowSize={5}
/>
```

## Migration Checklist Template

For each screen:

- [ ] Identify horizontal content (cards, buttons, stats)
- [ ] Determine item count and gap spacing
- [ ] Choose threshold (default 360px or custom)
- [ ] Extract rendering function
- [ ] Implement conditional layout (ScrollView vs View)
- [ ] Update styles (remove hardcoded widths)
- [ ] Add accessibility props
- [ ] Test on iPhone SE (small) and Pro Max (large)
- [ ] Test with VoiceOver/TalkBack
- [ ] Verify touch targets ≥48px
- [ ] Check landscape orientation
- [ ] Update documentation

## Future Enhancements

### Orientation Support

Add landscape mode detection:

```typescript
const isLandscape = screenWidth > screenHeight;
const threshold = isLandscape ? 600 : 360;
```

### Tablet Support (If Needed)

iPad dimensions (~768px+):
- Show 4-5 cards in row instead of 3
- Adjust threshold to 768px
- Use larger item widths (140-160px)

### Dynamic Content

Adjust layout based on content length:

```typescript
const itemCount = items.length;
const threshold = itemCount > 3 ? 420 : 360;
```

## Documentation Updates Required

When implementing hybrid layouts:

1. Update `CLAUDE.md` with hybrid layout pattern
2. Add examples to component library
3. Create Storybook stories for both modes
4. Document accessibility considerations
5. Add migration guide for developers

## Estimated Total Effort

**Phase 1**: 12-16 hours (4 screens)
**Phase 2**: 8-12 hours (3 screens)
**Phase 3**: 4-5 hours (4 screens)
**Design System**: 6-8 hours (hooks, components, testing)

**Total**: 30-41 hours (~1 week sprint)

---

## Implementation Priority

Start with:
1. ✅ HomeScreen stat cards (DONE - first implementation)
2. DocumentsScreen grid (if applicable)
3. HealthScreen vitals
4. Create reusable hook/component
5. Roll out to remaining screens

This phased approach ensures:
- Learning from early implementations
- Reusable patterns established
- Consistent experience across app
- Manageable testing scope
