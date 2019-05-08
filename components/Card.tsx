import * as React from 'react';
import { StyleSheet, BackHandler, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  PanGestureHandler,
  State as GestureState,
} from 'react-native-gesture-handler';

type Props = {
  direction: 'horizontal' | 'vertical';
  next?: Animated.Node<number>;
  current: Animated.Value<number>;
  layout: { width: number; height: number };
  animated: boolean;
  springConfig?: {
    damping?: number;
    mass?: number;
    stiffness?: number;
    restSpeedThreshold?: number;
    restDisplacementThreshold?: number;
  };
  onRemove: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

type Binary = 0 | 1;

const TRUE = 1;
const FALSE = 0;
const NOOP = 0;
const UNSET = -1;

const DIRECTION_VERTICAL = -1;
const DIRECTION_HORIZONTAL = 1;

const SWIPE_VELOCITY_THRESHOLD_DEFAULT = 500;
const SWIPE_DISTANCE_THRESHOLD_DEFAULT = 60;

const SWIPE_DISTANCE_MINIMUM = 5;

const {
  cond,
  eq,
  neq,
  set,
  and,
  or,
  greaterThan,
  lessThan,
  add,
  max,
  abs,
  block,
  stopClock,
  startClock,
  clockRunning,
  onChange,
  Value,
  Clock,
  call,
  spring,
  interpolate,
} = Animated;

const SPRING_CONFIG = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

export default class Card extends React.Component<Props> {
  static defaultProps = {
    direction: 'horizontal',
  };

  componentDidMount() {
    BackHandler.addEventListener('hardwareBackPress', this.handleBack);
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.handleBack);
  }

  private handleBack = () => {
    if (this.isVisibleValue) {
      this.nextIsVisible.setValue(FALSE);

      return true;
    } else {
      return false;
    }
  };

  componentDidUpdate(prevProps: Props) {
    const { layout, animated, direction, springConfig } = this.props;
    const { width, height } = layout;

    if (width !== prevProps.layout.width) {
      this.layout.width.setValue(width);
    }

    if (height !== prevProps.layout.height) {
      this.layout.height.setValue(height);
    }

    if (animated !== prevProps.animated) {
      this.isAnimated.setValue(animated ? TRUE : FALSE);
    }

    if (direction !== prevProps.direction) {
      this.direction.setValue(
        direction === 'vertical' ? DIRECTION_VERTICAL : DIRECTION_HORIZONTAL
      );
    }

    if (springConfig !== prevProps.springConfig) {
      this.springConfig.damping.setValue(
        springConfig && springConfig.damping !== undefined
          ? springConfig.damping
          : SPRING_CONFIG.damping
      );

      this.springConfig.mass.setValue(
        springConfig && springConfig.mass !== undefined
          ? springConfig.mass
          : SPRING_CONFIG.mass
      );

      this.springConfig.stiffness.setValue(
        springConfig && springConfig.stiffness !== undefined
          ? springConfig.stiffness
          : SPRING_CONFIG.stiffness
      );

      this.springConfig.restSpeedThreshold.setValue(
        springConfig && springConfig.restSpeedThreshold !== undefined
          ? springConfig.restSpeedThreshold
          : SPRING_CONFIG.restSpeedThreshold
      );

      this.springConfig.restDisplacementThreshold.setValue(
        springConfig && springConfig.restDisplacementThreshold !== undefined
          ? springConfig.restDisplacementThreshold
          : SPRING_CONFIG.restDisplacementThreshold
      );
    }
  }

  private isVisibleValue = TRUE;

  private isAnimated = new Value<Binary>(this.props.animated ? TRUE : FALSE);
  private isVisible = new Value<Binary>(TRUE);
  private nextIsVisible = new Value<Binary | -1>(UNSET);

  private clock = new Clock();
  private layout = {
    width: new Value(this.props.layout.width),
    height: new Value(this.props.layout.height),
  };

  private direction = new Value(
    this.props.direction === 'vertical'
      ? DIRECTION_VERTICAL
      : DIRECTION_HORIZONTAL
  );

  private position = new Value(
    this.props.direction === 'vertical'
      ? this.props.layout.height
      : this.props.layout.width
  );

  private gesture = new Value(0);
  private offset = new Value(0);
  private velocity = new Value(0);

  private gestureState = new Value(0);

  private isSwiping = new Value(FALSE);
  private isSwipeGesture = new Value(FALSE);

  private springConfig = {
    damping: new Value(
      this.props.springConfig && this.props.springConfig.damping !== undefined
        ? this.props.springConfig.damping
        : SPRING_CONFIG.damping
    ),
    mass: new Value(
      this.props.springConfig && this.props.springConfig.mass !== undefined
        ? this.props.springConfig.mass
        : SPRING_CONFIG.mass
    ),
    stiffness: new Value(
      this.props.springConfig && this.props.springConfig.stiffness !== undefined
        ? this.props.springConfig.stiffness
        : SPRING_CONFIG.stiffness
    ),
    restSpeedThreshold: new Value(
      this.props.springConfig &&
      this.props.springConfig.restSpeedThreshold !== undefined
        ? this.props.springConfig.restSpeedThreshold
        : SPRING_CONFIG.restSpeedThreshold
    ),
    restDisplacementThreshold: new Value(
      this.props.springConfig &&
      this.props.springConfig.restDisplacementThreshold !== undefined
        ? this.props.springConfig.restDisplacementThreshold
        : SPRING_CONFIG.restDisplacementThreshold
    ),
  };

  private transitionTo = (isVisible: Binary | Animated.Node<number>) => {
    const toValue = new Value(0);
    const frameTime = new Value(0);

    const state = {
      position: this.position,
      time: new Value(0),
      finished: new Value(FALSE),
    };

    return block([
      cond(clockRunning(this.clock), NOOP, [
        // Animation wasn't running before
        // Set the initial values and start the clock
        set(
          toValue,
          cond(
            isVisible,
            0,
            cond(
              eq(this.direction, DIRECTION_VERTICAL),
              this.layout.height,
              this.layout.width
            )
          )
        ),
        set(frameTime, 0),
        set(state.time, 0),
        set(state.finished, FALSE),
        set(this.isVisible, isVisible),
        startClock(this.clock),
      ]),
      spring(
        this.clock,
        { ...state, velocity: this.velocity },
        { ...SPRING_CONFIG, ...this.springConfig, toValue }
      ),
      cond(state.finished, [
        // Reset values
        set(this.isSwipeGesture, FALSE),
        set(this.gesture, 0),
        set(this.velocity, 0),
        // When the animation finishes, stop the clock
        stopClock(this.clock),
        call([this.isVisible], ([value]: ReadonlyArray<Binary>) => {
          const isVisible = Boolean(value);

          if (!isVisible) {
            this.props.onRemove();
          }
        }),
      ]),
    ]);
  };

  private translate = block([
    onChange(
      this.isVisible,
      call([this.isVisible], ([value]) => {
        this.isVisibleValue = value;
      })
    ),
    onChange(
      this.nextIsVisible,
      cond(neq(this.nextIsVisible, UNSET), [
        // Stop any running animations
        cond(clockRunning(this.clock), stopClock(this.clock)),
        // Update the index to trigger the transition
        set(this.isVisible, this.nextIsVisible),
        set(this.nextIsVisible, UNSET),
      ])
    ),
    // Synchronize the translation with the animated value representing the progress
    set(
      this.props.current,
      cond(
        or(eq(this.layout.width, 0), eq(this.layout.height, 0)),
        this.isVisible,
        interpolate(this.position, {
          inputRange: [
            0,
            cond(
              eq(this.direction, DIRECTION_VERTICAL),
              this.layout.height,
              this.layout.width
            ),
          ],
          outputRange: [1, 0],
        })
      )
    ),
    cond(
      eq(this.gestureState, GestureState.ACTIVE),
      [
        cond(this.isSwiping, NOOP, [
          // We weren't dragging before, set it to true
          set(this.isSwiping, TRUE),
          set(this.isSwipeGesture, TRUE),
          // Also update the drag offset to the last position
          set(this.offset, this.position),
        ]),
        // Update position with next offset + gesture distance
        set(this.position, max(add(this.offset, this.gesture), 0)),
        // Stop animations while we're dragging
        stopClock(this.clock),
      ],
      [
        set(this.isSwiping, FALSE),
        cond(
          this.isAnimated,
          this.transitionTo(
            cond(
              or(
                and(
                  greaterThan(abs(this.gesture), SWIPE_DISTANCE_MINIMUM),
                  greaterThan(
                    abs(this.velocity),
                    SWIPE_VELOCITY_THRESHOLD_DEFAULT
                  )
                ),
                cond(
                  greaterThan(
                    abs(this.gesture),
                    SWIPE_DISTANCE_THRESHOLD_DEFAULT
                  ),
                  TRUE,
                  FALSE
                )
              ),
              cond(
                lessThan(
                  cond(eq(this.velocity, 0), this.gesture, this.velocity),
                  0
                ),
                TRUE,
                FALSE
              ),
              this.isVisible
            )
          ),
          set(this.position, 0)
        ),
      ]
    ),
    this.position,
  ]);

  private handleGestureEventHorizontal = Animated.event([
    {
      nativeEvent: {
        translationX: this.gesture,
        velocityX: this.velocity,
        state: this.gestureState,
      },
    },
  ]);

  private handleGestureEventVertical = Animated.event([
    {
      nativeEvent: {
        translationY: this.gesture,
        velocityY: this.velocity,
        state: this.gestureState,
      },
    },
  ]);

  render() {
    const {
      layout,
      animated,
      current,
      next,
      direction,
      style,
      children,
    } = this.props;

    const translate = next
      ? interpolate(next, {
          inputRange: [0, 1],
          outputRange: [0, -80],
        })
      : 0;

    const handleGestureEvent =
      direction === 'vertical'
        ? this.handleGestureEventVertical
        : this.handleGestureEventHorizontal;

    return (
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            // We don't want the user to be able to press through the overlay when the card is open
            // One approach is to adjust the pointerEvents based on the progress
            // But we can also send the overlay behind the screen, which works, and is much less code
            zIndex: cond(greaterThan(current, 0), 0, -1),
            transform: [
              direction === 'vertical'
                ? { translateY: translate }
                : { translateX: translate },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.overlay, { opacity: current }]} />
        <PanGestureHandler
          enabled={layout.width !== 0 && animated}
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleGestureEvent}
        >
          <Animated.View
            style={[
              styles.card,
              {
                transform: [
                  direction === 'vertical'
                    ? { translateY: this.translate }
                    : { translateX: this.translate },
                ],
              },
              style,
            ]}
          >
            {children}
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
    shadowOffset: { width: -1, height: 1 },
    shadowRadius: 5,
    shadowColor: '#000',
    backgroundColor: 'white',
    elevation: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
