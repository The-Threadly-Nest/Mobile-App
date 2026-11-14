import React, { useRef, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface BottomAnchoredChatScrollViewProps
  extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Short conversations start directly below the header. Keep the existing
 * import name for screens, but use a normal, upright chronological scroll view.
 */
export default function BottomAnchoredChatScrollView({
  children,
  contentContainerStyle,
  style,
  onScroll,
  onContentSizeChange,
  onLayout,
  ...scrollViewProps
}: BottomAnchoredChatScrollViewProps) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const nearBottom = useRef(true);
  return (
    <ScrollView
      {...scrollViewProps}
      ref={scroll}
      style={style}
      contentContainerStyle={[styles.viewportContent, contentContainerStyle, styles.topAligned]}
      scrollEventThrottle={16}
      onScroll={event => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        nearBottom.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 80;
        onScroll?.(event);
      }}
      onContentSizeChange={(width, height) => {
        // Short conversations remain at offset zero; long conversations follow
        // new messages only when the person is already near the latest message.
        if (nearBottom.current) scroll.current?.scrollToEnd({ animated: false });
        onContentSizeChange?.(width, height);
      }}
      onLayout={event => {
        if (nearBottom.current) scroll.current?.scrollToEnd({ animated: false });
        onLayout?.(event);
      }}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewportContent: {
    flexGrow: 1,
  },
  topAligned: {
    justifyContent: 'flex-start',
  },
});
