import { Button } from '@/components/ui/button'
import { createSampleData } from '@/data/sample'
import { useStore } from '@/data/store'
import { todayISO } from './days'

export function EmptyState() {
  const addLane = useStore((state) => state.addLane)
  const replaceData = useStore((state) => state.replaceData)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-[20px] font-medium text-(--text)">开始规划你的时间线</h1>
      <p className="text-[14px] text-(--text-muted)">添加板块和阶段，一眼看清现在处在哪里。</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => addLane()}>从空白开始</Button>
        <Button variant="outline" onClick={() => replaceData(createSampleData(todayISO()))}>
          载入示例
        </Button>
      </div>
    </div>
  )
}
