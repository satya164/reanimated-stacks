import * as React from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import Card from './Card';
import HeaderAnimated from './Header/HeaderAnimated';
import {
  Route,
  Layout,
  TransitionSpec,
  CardStyleInterpolator,
  HeaderStyleInterpolator,
} from '../types';
import HeaderSimple from './Header/HeaderSimple';

export type SceneProps<T> = {
  route: T;
  index: number;
};

type ProgressValues = {
  [key: string]: Animated.Value<number>;
};

type Props<T extends Route> = {
  routes: T[];
  initialRoutes: string[];
  closingRoutes: string[];
  onGoBack: (props: { route: T }) => void;
  onCloseRoute: (props: { route: T }) => void;
  renderScene: (props: SceneProps<T>) => React.ReactNode;
  headerMode: 'screen' | 'float';
  direction: 'horizontal' | 'vertical';
  transitionSpec: {
    open: TransitionSpec;
    close: TransitionSpec;
  };
  cardStyleInterpolator: CardStyleInterpolator;
  headerStyleInterpolator: HeaderStyleInterpolator;
};

type State<T> = {
  routes: T[];
  progress: ProgressValues;
  layout: Layout;
};

export default class Stack<T extends Route> extends React.Component<
  Props<T>,
  State<T>
> {
  static getDerivedStateFromProps(props: Props<Route>, state: State<Route>) {
    if (props.routes === state.routes) {
      return null;
    }

    return {
      progress: props.routes.reduce(
        (acc, curr) => {
          acc[curr.key] = state.progress[curr.key] || new Animated.Value(0);

          return acc;
        },
        {} as ProgressValues
      ),
      routes: props.routes,
    };
  }

  state: State<T> = {
    routes: [],
    progress: {},
    layout: { width: 0, height: 0 },
  };

  private handleLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;

    this.setState({ layout: { width, height } });
  };

  render() {
    const {
      routes,
      initialRoutes,
      closingRoutes,
      onGoBack,
      onCloseRoute,
      renderScene,
      headerMode,
      direction,
      transitionSpec,
      cardStyleInterpolator,
      headerStyleInterpolator,
    } = this.props;
    const { layout, progress } = this.state;

    return (
      <React.Fragment>
        {headerMode === 'float' ? (
          <HeaderAnimated
            layout={layout}
            scenes={routes.map((route, i) => ({
              route,
              progress: progress[route.key],
              title: i % 2 ? `Screen ${i}` : `Foo ${i}`,
            }))}
            onGoBack={onGoBack}
            styleInterpolator={headerStyleInterpolator}
          />
        ) : null}
        <View
          style={styles.container}
          onLayout={this.handleLayout}
          pointerEvents={layout.height && layout.width ? 'box-none' : 'none'}
        >
          {routes.map((route, index, self) => {
            const focused = index === self.length - 1;
            const current = progress[route.key];
            const next = self[index + 1]
              ? progress[self[index + 1].key]
              : undefined;

            return (
              <Card
                key={route.key}
                direction={direction}
                layout={layout}
                current={current}
                next={next}
                closing={closingRoutes.includes(route.key)}
                onClose={() => onCloseRoute({ route })}
                animateIn={!initialRoutes.includes(route.key)}
                gesturesEnabled={index !== 0}
                transitionSpec={transitionSpec}
                styleInterpolator={cardStyleInterpolator}
                accessibilityElementsHidden={!focused}
                importantForAccessibility={
                  focused ? 'auto' : 'no-hide-descendants'
                }
                pointerEvents="box-none"
                style={StyleSheet.absoluteFill}
              >
                {headerMode === 'screen' ? (
                  <HeaderSimple
                    scene={{
                      route,
                      title: index % 2 ? `Screen ${index}` : `Foo ${index}`,
                      progress: current
                    }}
                    onGoBack={
                      index !== 0 ? () => onGoBack({ route }) : undefined
                    }
                    layout={layout}
                    styleInterpolator={headerStyleInterpolator}
                  />
                ) : null}
                {renderScene({
                  route,
                  index,
                })}
              </Card>
            );
          })}
        </View>
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
