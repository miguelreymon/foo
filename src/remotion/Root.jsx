import { Composition } from 'remotion';
import { HateRankingScroll, HateRankingNBA, HateRankingInferno } from './compositions/HateRankingVideo';
import { VideoAnalysisStats } from './compositions/VideoAnalysisStats';
import { ChannelEvolutionVideo } from './compositions/ChannelEvolutionVideo';
import { VideoAnalysisVertical } from './compositions/VideoAnalysisVertical';
import { DevilPresenterVideo } from './compositions/DevilPresenterVideo';
import { VideoPresenterVideo } from './compositions/VideoPresenterVideo';
import { LongFormChannelVideo } from './compositions/LongFormChannelVideo';

export const RemotionRoot = () => {
  return (
    <>
      {/* Ranking Style 1: Scroll Clásico - 30 seconds (9:16 vertical) */}
      <Composition
        id="HateRankingScroll"
        component={HateRankingScroll}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: [],
        }}
      />

      {/* Ranking Style 2: NBA Countdown - 30 seconds (9:16 vertical) */}
      <Composition
        id="HateRankingNBA"
        component={HateRankingNBA}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: [],
        }}
      />

      {/* Ranking Style 3: Inferno Mode - 30 seconds (9:16 vertical) */}
      <Composition
        id="HateRankingInferno"
        component={HateRankingInferno}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: [],
        }}
      />

      {/* Video Analysis Stats - 7 seconds (Horizontal) */}
      <Composition
        id="VideoStats"
        component={VideoAnalysisStats}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {},
        }}
      />

      {/* Video Analysis Vertical - 60 seconds (9:16 for Reels/TikTok) */}
      <Composition
        id="VideoStatsVertical"
        component={VideoAnalysisVertical}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: {},
        }}
      />

      {/* Channel Evolution - 10 seconds */}
      <Composition
        id="ChannelEvolution"
        component={ChannelEvolutionVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {
            channel_name: '',
            analyses: [],
            avg_hate: 0,
            trend: 0,
          },
        }}
      />

      {/* Devil Presenter Video - 45 seconds (9:16 for Reels/TikTok) */}
      <Composition
        id="DevilPresenter"
        component={DevilPresenterVideo}
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: {},
        }}
      />

      {/* Video Presenter with Green Screen - 45 seconds (9:16 for Reels/TikTok) */}
      <Composition
        id="VideoPresenter"
        component={VideoPresenterVideo}
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data: {},
        }}
      />

      {/* Long-form YouTube channel video - 10 minutes (16:9 horizontal) */}
      <Composition
        id="LongFormChannel"
        component={LongFormChannelVideo}
        durationInFrames={18000}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {},
        }}
      />
    </>
  );
};
