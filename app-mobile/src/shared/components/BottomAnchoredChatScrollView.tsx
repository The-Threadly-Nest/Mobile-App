import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
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
 * Starts at the visual bottom without calling scrollToEnd. The viewport and
 * its single content cell are inverted together, keeping content upright while
 * making offset zero the newest end of the conversation.
 */
export default function BottomAnchoredChatScrollView({
  children,
  contentContainerStyle,
  style,
  ...scrollViewProps
}: BottomAnchoredChatScrollViewProps) {
  return (
    <ScrollView
      {...scrollViewProps}
      style={[style, styles.invertedViewport]}
      contentContainerStyle={styles.viewportContent}
    >
      <View style={[styles.uprightContent, contentContainerStyle]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  invertedViewport: {
    transform: [{ scaleY: -1 }],
  },
  viewportContent: {
    flexGrow: 1,
  },
  uprightContent: {
    minHeight: '100%',
    justifyContent: 'flex-end',
    transform: [{ scaleY: -1 }],
  },
});
