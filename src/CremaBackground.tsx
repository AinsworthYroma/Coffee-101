import LiquidEther from './vendor/react-bits/LiquidEther'

const colors = ['#482719', '#68402a', '#a56836', '#d4a565', '#f0d9b3']

export default function CremaBackground({ reduced }: { reduced: boolean }) {
  return (
    <>
      <div className="crema-background" aria-hidden="true">
        <div className="crema-fallback" aria-hidden="true" />
        <div className="crema-grain" />
        <LiquidEther
          colors={colors}
          backgroundColor="transparent"
          intensity={0.85}
          mouseForce={20}
          cursorSize={125}
          persistence={0.92}
          viscosity={0.12}
          resolution={0.28}
          maxDevicePixelRatio={0.8}
          autoDemo
          autoSpeed={0.22}
          autoIntensity={8}
          intro={false}
          clickBurst={false}
          paused={reduced}
        />
      </div>
    </>
  )
}