import { Button } from '@/components/ui/button'
import { createShowcaseData } from '@/data/showcase'
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
        <Button variant="outline" onClick={() => replaceData(createShowcaseData(todayISO()))}>
          载入示例
        </Button>
      </div>
      <p className="text-[12px] text-(--text-muted)">
        示例：一位大四学生同时备考考研、期末和六级，还要做毕设、找实习
      </p>
    </div>
  )
}
