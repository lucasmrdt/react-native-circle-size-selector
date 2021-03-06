// @flow
import * as React from "react"
import { StyleSheet, View, ViewPropTypes, PanResponder } from "react-native"
import Circle from "./Circle"
import { range, getDistance } from "./Utils"

type Position = { x: number, y: number }
type GestureState = { dx: number, dy: number }

type State = {
  value: number,
  width: number,
  height: number,
  resizing: boolean,
}

type Props = {
  minValue?: number,
  maxValue?: number,
  manualValues: ?(number[]),
  initialValue: number,
  showGraduationLinesOnResizing: boolean,
  onChange: (value: number) => void,
  onSelected: (value: number) => void,
  outermostCircleStyle: ViewPropTypes.style,
  graduationLineCircleStyle: ViewPropTypes.style,
  currentValueCircleStyle: ViewPropTypes.style,
  resizingCurrentValueCircleStyle: ViewPropTypes.style,
  children?: React.Node,
  minRadius?: number,
  shouldAlwaysBeDisplayedInResizeMode?: boolean,
}

type DefaultProps = {
  manualValues: ?(number[]),
  showGraduationLinesOnResizing: boolean,
  onChange: (value: number) => void,
  onSelected: (value: number) => void,
  outermostCircleStyle: ViewPropTypes.style,
  graduationLineCircleStyle: ViewPropTypes.style,
  currentValueCircleStyle: ViewPropTypes.style,
  resizingCurrentValueCircleStyle: ViewPropTypes.style,
  minRadius: number,
  shouldAlwaysBeDisplayedInResizeMode: boolean,
}

const defaultStyles = StyleSheet.create({
  outermostCircle: {
    borderWidth: 2,
    borderColor: "rgb(240, 240, 240)",
    backgroundColor: "rgb(247, 247, 247)",
  },
  graduationLineCircle: {
    borderWidth: 1,
    borderColor: "rgb(230, 230, 230)",
  },
  currentValueCircle: {
    borderWidth: 1,
    borderColor: "rgb(200, 240, 240)",
    backgroundColor: "rgba(201, 250, 245, 0.8)",
  },
  resizingCurrentValueCircle: {
    backgroundColor: "rgba(187, 232, 227, 0.6)",
  },
})

export default class CircleSizeSelector extends React.Component<Props, State> {
  props: Props
  state = {
    value: this.props.initialValue,
    width: 0,
    height: 0,
    resizing: false,
  }

  static defaultProps: DefaultProps = {
    manualValues: null,
    showGraduationLinesOnResizing: true,
    outermostCircleStyle: defaultStyles.outermostCircle,
    graduationLineCircleStyle: defaultStyles.graduationLineCircle,
    currentValueCircleStyle: defaultStyles.currentValueCircle,
    resizingCurrentValueCircleStyle: defaultStyles.resizingCurrentValueCircle,
    onChange: () => {},
    onSelected: () => {},
    minRadius: 0,
    shouldAlwaysBeDisplayedInResizeMode: false,
  }

  constructor(props: Props) {
    super(props)
    this._panResponder = this.createPanResponder()
  }

  _panResponder: any
  _value: number
  _tapStartPosition: ?Position
  _previousPosition: ?Position

  get minValue(): number {
    const { minValue, manualValues } = this.props
    if (minValue == null) {
      if (manualValues == null) {
        throw new Error("{min|max}Value or manualValues must be set")
      }
      return Math.min(...manualValues)
    }
    return minValue
  }
  get maxValue(): number {
    const { maxValue, manualValues } = this.props
    if (maxValue == null) {
      if (manualValues == null) {
        throw new Error("{min|max}Value or manualValues must be set")
      }
      return Math.max(...manualValues)
    }
    return maxValue
  }

  get maxArea(): number {
    const radius = this.maxRadius
    return radius * radius * Math.PI
  }

  get maxRadius(): number {
    return this.state.width / 2
  }

  get centerPosition(): Position {
    return { x: this.state.width / 2, y: this.state.height / 2 }
  }

  get valuesInRange(): number[] {
    const { manualValues } = this.props
    if (manualValues != null) {
      const sorted = manualValues.slice().sort((n1, n2) => {
        return n1 - n2
      })
      return sorted
    }
    return range(this.minValue, this.maxValue)
  }

  get radiusAtCurrentValue(): number {
    return this.radiusAtValue(this.state.value)
  }

  createPanResponder() {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: this.onPanResponderGrant,
      onPanResponderMove: this.onPanResponderMove,
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: this.onPanResponderRelease,
      onPanResponderTerminate: this.onPanResponderTerminate,
      onShouldBlockNativeResponder: () => true,
    })
  }

  radiusAtValue(v: number) {
    const { minRadius } = this.props
    const area = this.getAreaAtValue(v)
    return Math.sqrt(area / Math.PI) + minRadius
  }

  selectValueFromRadius(radius: number) {
    const found = this.valuesInRange.find(v => this.radiusAtValue(v) >= radius)
    if (found != null) {
      return found
    }
    return this.maxValue
  }

  getAreaAtValue(value: number): number {
    return (this.maxArea * (value + 1)) / (this.maxValue + 1)
  }

  clear() {
    this._previousPosition = null
    this._tapStartPosition = null
  }

  onLayout = (e: Object) => {
    const { width, height } = e.nativeEvent.layout
    this.setState({ width, height })
  }

  onPanResponderGrant = (e: Object, gestureState: GestureState) => {
    const { locationX, locationY } = e.nativeEvent
    this.setState({ resizing: true })
    const center = this.centerPosition
    const leftTop = {
      x: center.x - this.radiusAtValue(this._value || this.state.value),
      y: center.y - this.radiusAtValue(this._value || this.state.value),
    }
    this._tapStartPosition = {
      x: leftTop.x + locationX,
      y: leftTop.y + locationY,
    }
  }

  onPanResponderMove = (e: Object, gestureState: GestureState) => {
    const { dx, dy } = gestureState
    if (this._tapStartPosition == null) {
      throw new Error("_tapStartPosition is null")
    }
    const position = {
      x: this._tapStartPosition.x + dx,
      y: this._tapStartPosition.y + dy,
    }
    if (this._previousPosition == null) {
      this._previousPosition = position
      return
    }
    const previousRadius = getDistance(
      this.centerPosition,
      this._previousPosition,
    )
    const radius = getDistance(this.centerPosition, position)

    const expanding = radius >= previousRadius

    const value = this.selectValueFromRadius(radius)
    this._value = value
    this._previousPosition = position
    if (expanding && value <= this.state.value) {
      return
    }
    if (!expanding && value >= this.state.value) {
      return
    }
    this.setState({ value })
    this.props.onChange(value)
  }

  onPanResponderRelease = () => {
    this.clear()
    this.props.onSelected(this.state.value)
  }

  onPanResponderTerminate = () => {
    this.clear()
  }

  render() {
    const { resizing } = this.state
    const {
      outermostCircleStyle,
      graduationLineCircleStyle,
      currentValueCircleStyle,
      resizingCurrentValueCircleStyle,
      children,
      shouldAlwaysBeDisplayedInResizeMode,
    } = this.props
    const valuesInRange = this.valuesInRange
    const valuesLength = valuesInRange.length
    return (
      <View
        style={styles.container}
        onLayout={this.onLayout}
        {...this._panResponder.panHandlers}
      >
        {valuesInRange.reverse().map((v, i) => {
          const radius = this.radiusAtValue(v)
          const isOutermost = v === this.maxValue
          const shouldShowGraduationLine =
            (resizing || shouldAlwaysBeDisplayedInResizeMode) &&
            this.props.showGraduationLinesOnResizing
          if (!isOutermost && !shouldShowGraduationLine) {
            return null
          }
          if (!isOutermost && valuesLength > 30) {
            if (i % (valuesLength / 10) !== 0) {
              return null
            }
          }
          return (
            <Circle
              key={`circle-${i}`}
              cx={this.centerPosition.x}
              cy={this.centerPosition.y}
              radius={radius}
              style={[
                shouldShowGraduationLine && graduationLineCircleStyle,
                isOutermost && outermostCircleStyle,
              ]}
            />
          )
        })}
        <Circle
          key={"circle-current-value"}
          cx={this.centerPosition.x}
          cy={this.centerPosition.y}
          radius={this.radiusAtCurrentValue}
          style={[
            currentValueCircleStyle,
            (resizing || shouldAlwaysBeDisplayedInResizeMode) &&
              resizingCurrentValueCircleStyle,
          ]}
        />
        {children}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
})
