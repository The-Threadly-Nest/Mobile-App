import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, View, TextInput, type ScrollViewProps } from "react-native";
import { keyboardScrollAdjustment } from "../utils/keyboardVisibility";

/** Measures the actual visible scroll area, including inside a centered modal. */
export const KeyboardAwareScrollView = forwardRef<React.ComponentRef<typeof ScrollView>, ScrollViewProps & { keyboardGap?: number }>(
  function KeyboardAwareScrollView({ children, keyboardGap = 24, onFocus, onBlur, onScroll, onLayout, ...props }, forwardedRef) {
    const scroll = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
    const offset = useRef(0);
    const keyboardTop = useRef<number | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted = useRef(false);
    const focusWithin = useRef(false);
    const [bottomSpace, setBottomSpace] = useState(0);

    const reveal = useCallback(() => {
      const top = keyboardTop.current;
      const input = TextInput.State.currentlyFocusedInput();
      if (!focusWithin.current || !scroll.current || !input || top === null) return;
      scroll.current.getNativeScrollRef()?.measureInWindow((_x, viewportY, _width, viewportHeight) => {
        if (!mounted.current || !viewportHeight) return;
        // Avoid adding the keyboard height twice when adjustResize or a parent
        // KeyboardAvoidingView has already reduced the visible viewport.
        setBottomSpace(Math.max(0, viewportY + viewportHeight - top) + keyboardGap);
        input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
          if (!mounted.current || keyboardTop.current === null || TextInput.State.currentlyFocusedInput() !== input) return;
          const adjustment = keyboardScrollAdjustment(inputY, inputHeight, viewportY, viewportHeight, top, keyboardGap);
          if (adjustment) scroll.current?.scrollTo({ y: Math.max(0, offset.current + adjustment), animated: true });
        });
      });
    }, [keyboardGap]);

    const scheduleReveal = useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(reveal, 120);
    }, [reveal]);

    // Re-measure after added scroll space has actually been laid out.
    useEffect(() => { if (bottomSpace) scheduleReveal(); }, [bottomSpace, scheduleReveal]);

    useEffect(() => {
      mounted.current = true;
      const show = Keyboard.addListener("keyboardDidShow", event => {
        keyboardTop.current = event.endCoordinates.screenY;
        scheduleReveal();
      });
      const change = Keyboard.addListener("keyboardDidChangeFrame", event => {
        if (keyboardTop.current !== null) { keyboardTop.current = event.endCoordinates.screenY; scheduleReveal(); }
      });
      const hide = Keyboard.addListener("keyboardDidHide", () => {
        keyboardTop.current = null; setBottomSpace(0);
        if (timer.current) clearTimeout(timer.current);
      });
      return () => {
        mounted.current = false;
        show.remove(); change.remove(); hide.remove();
        if (timer.current) clearTimeout(timer.current);
      };
    }, [scheduleReveal]);

    return <ScrollView {...props}
      ref={node => { scroll.current = node; if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? "handled"}
      keyboardDismissMode={props.keyboardDismissMode ?? "on-drag"}
      automaticallyAdjustKeyboardInsets={false}
      scrollEventThrottle={16}
      onFocus={event => { focusWithin.current = true; keyboardTop.current = Keyboard.metrics()?.screenY ?? keyboardTop.current; onFocus?.(event); scheduleReveal(); }}
      onBlur={event => { focusWithin.current = false; onBlur?.(event); }}
      onLayout={event => { onLayout?.(event); scheduleReveal(); }}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}>
      {children}
      {bottomSpace > 0 && <View pointerEvents="none" accessible={false} style={{ height: bottomSpace }} />}
    </ScrollView>;
  },
);
