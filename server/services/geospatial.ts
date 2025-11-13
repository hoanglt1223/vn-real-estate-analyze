import { polygon as turfPolygon, area as turfArea, centroid as turfCentroid, bearing as turfBearing, point as turfPoint, distance as turfDistance } from '@turf/turf';

export interface PropertyMetrics {
  area: number;
  orientation: string;
  frontageCount: number;
  center: { lat: number; lng: number };
}

export function calculatePropertyMetrics(coordinates: number[][]): PropertyMetrics {
  const poly = turfPolygon([coordinates]);
  const areaValue = turfArea(poly);
  
  const centerFeature = turfCentroid(poly);
  const center = {
    lat: centerFeature.geometry.coordinates[1],
    lng: centerFeature.geometry.coordinates[0]
  };

  const brg = turfBearing(
    turfPoint(coordinates[0]),
    turfPoint(coordinates[1])
  );
  const orientation = getOrientation(brg);

  const frontageCount = coordinates.length - 1;

  return {
    area: Math.round(areaValue),
    orientation,
    frontageCount,
    center
  };
}

function getOrientation(bearing: number): string {
  const normalized = ((bearing + 360) % 360);
  if (normalized >= 337.5 || normalized < 22.5) return 'Bắc';
  if (normalized >= 22.5 && normalized < 67.5) return 'Đông Bắc';
  if (normalized >= 67.5 && normalized < 112.5) return 'Đông';
  if (normalized >= 112.5 && normalized < 157.5) return 'Đông Nam';
  if (normalized >= 157.5 && normalized < 202.5) return 'Nam';
  if (normalized >= 202.5 && normalized < 247.5) return 'Tây Nam';
  if (normalized >= 247.5 && normalized < 292.5) return 'Tây';
  return 'Tây Bắc';
}

export interface RiskAssessment {
  risks: Array<{
    id: string;
    type: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    distance?: number;
    icon: string;
  }>;
  overallRiskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
}

export function assessRisks(
  center: { lat: number; lng: number },
  infrastructure: any
): RiskAssessment {
  const risks: any[] = [];
  let totalRiskPoints = 0;

  const centerPoint = turfPoint([center.lng, center.lat]);

  if (infrastructure.industrial && infrastructure.industrial.length > 0) {
    const closest = infrastructure.industrial[0];
    if (closest.lat && closest.lng) {
      const distance = turfDistance(
        centerPoint,
        turfPoint([closest.lng, closest.lat]),
        { units: 'meters' }
      );

      if (distance < 500) {
        risks.push({
          id: 'industrial_close',
          type: 'high',
          title: 'Rất gần khu công nghiệp',
          description: 'Khu đất nằm rất gần khu công nghiệp (dưới 500m), có thể ảnh hưởng nghiêm trọng đến chất lượng không khí, tiếng ồn và sức khỏe.',
          distance: Math.round(distance),
          icon: 'pollution'
        });
        totalRiskPoints += 30;
      } else if (distance < 2000) {
        risks.push({
          id: 'industrial_near',
          type: 'medium',
          title: 'Gần khu công nghiệp',
          description: 'Khu đất nằm trong bán kính 2km từ khu công nghiệp, có thể ảnh hưởng đến chất lượng không khí và tiếng ồn.',
          distance: Math.round(distance),
          icon: 'pollution'
        });
        totalRiskPoints += 15;
      }
    }
  }

  if (infrastructure.power && infrastructure.power.length > 0) {
    const closest = infrastructure.power[0];
    if (closest.lat && closest.lng) {
      const distance = turfDistance(
        centerPoint,
        turfPoint([closest.lng, closest.lat]),
        { units: 'meters' }
      );

      if (distance < 200) {
        risks.push({
          id: 'power_close',
          type: 'high',
          title: 'Rất gần trạm điện cao thế',
          description: 'Khu đất nằm rất gần trạm điện cao thế, có thể ảnh hưởng đến sức khỏe và giá trị bất động sản.',
          distance: Math.round(distance),
          icon: 'power'
        });
        totalRiskPoints += 25;
      } else if (distance < 500) {
        risks.push({
          id: 'power_near',
          type: 'medium',
          title: 'Gần trạm điện',
          description: 'Có trạm điện trong bán kính 500m. Khoảng cách tương đối an toàn nhưng cần lưu ý.',
          distance: Math.round(distance),
          icon: 'power'
        });
        totalRiskPoints += 10;
      }
    }
  }

  if (infrastructure.cemetery && infrastructure.cemetery.length > 0) {
    const closest = infrastructure.cemetery[0];
    if (closest.lat && closest.lng) {
      const distance = turfDistance(
        centerPoint,
        turfPoint([closest.lng, closest.lat]),
        { units: 'meters' }
      );

      if (distance < 300) {
        risks.push({
          id: 'cemetery_close',
          type: 'high',
          title: 'Rất gần nghĩa trang',
          description: 'Khu đất nằm rất gần nghĩa trang (dưới 300m), có thể ảnh hưởng đến tâm lý và giá trị bất động sản.',
          distance: Math.round(distance),
          icon: 'cemetery'
        });
        totalRiskPoints += 20;
      } else if (distance < 1000) {
        risks.push({
          id: 'cemetery_near',
          type: 'low',
          title: 'Gần nghĩa trang',
          description: 'Có nghĩa trang trong bán kính 1km. Một số người có thể cân nhắc yếu tố này.',
          distance: Math.round(distance),
          icon: 'cemetery'
        });
        totalRiskPoints += 5;
      }
    }
  }

  const overallRiskLevel = totalRiskPoints >= 40 ? 'high' : totalRiskPoints >= 15 ? 'medium' : 'low';
  const riskScore = Math.min(100, totalRiskPoints);

  return {
    risks,
    overallRiskLevel,
    riskScore
  };
}
