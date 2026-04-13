import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Play, GraduationCap } from 'lucide-react';

/** 教育動画（タイトル・投稿者・投稿日時・YouTube URL） */
export type TrainingVideo = {
  id: string;
  title: string;
  author: string;
  postedAt: string;
  youtubeUrl: string;
};

const DEMO_VIDEOS: TrainingVideo[] = [
  {
    id: 'tv-1',
    title: '現場での安全確認の基本',
    author: '安全管理担当',
    postedAt: '2026-03-01T10:00:00',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    id: 'tv-2',
    title: '左官工事の品質チェックポイント',
    author: '品質保証室',
    postedAt: '2026-02-15T14:30:00',
    youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  },
  {
    id: 'tv-3',
    title: '見積システムの入力手順（初級）',
    author: '情報システム',
    postedAt: '2026-01-20T09:00:00',
    youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
  },
];

function formatPostedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const TrainingVideos: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-primary" />
          教育動画
        </h1>
        <p className="text-sm text-muted-foreground">社内教育用の動画一覧です。YouTubeで再生できます。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {DEMO_VIDEOS.map((v) => (
          <Card key={v.id} className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base leading-snug">{v.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>投稿者: {v.author}</p>
                <p>投稿日時: {formatPostedAt(v.postedAt)}</p>
              </div>
              <Button
                variant="default"
                className="w-full sm:w-auto"
                onClick={() => window.open(v.youtubeUrl, '_blank', 'noopener,noreferrer')}
              >
                <Play className="w-4 h-4 mr-2" />
                YouTubeで再生
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TrainingVideos;
