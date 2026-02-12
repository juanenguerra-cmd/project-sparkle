import { describe, expect, it } from 'vitest';
import { getLineListingRecommendations } from '@/lib/database';

describe('line listing recommendations', () => {
  it('includes note-based respiratory recommendations from symptom category', () => {
    const db: any = {
      census: {
        residentsByMrn: {
          '100': { mrn: '100', name: 'Alice', unit: 'A', room: '101', active_on_census: true }
        }
      },
      records: {
        abx: [],
        line_listings: [],
        notes: [
          {
            id: 'n1',
            mrn: '100',
            residentName: 'Alice',
            unit: 'A',
            room: '101',
            text: 'Resident with new respiratory symptoms and cough',
            symptomCategory: 'respiratory',
            createdAt: '2026-01-01T10:00:00.000Z'
          }
        ]
      },
      settings: {}
    };

    const recommendations = getLineListingRecommendations(db);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].sourceType).toBe('note');
    expect(recommendations[0].category).toBe('respiratory');
    expect(recommendations[0].mrn).toBe('100');
  });

  it('maps GI and Skin from note category for line listing recommendations', () => {
    const db: any = {
      census: {
        residentsByMrn: {
          '300': { mrn: '300', name: 'Cara', unit: 'C', room: '303', active_on_census: true },
          '301': { mrn: '301', name: 'Dan', unit: 'D', room: '304', active_on_census: true }
        }
      },
      records: {
        abx: [],
        line_listings: [],
        notes: [
          {
            id: 'n-gi',
            mrn: '300',
            residentName: 'Cara',
            unit: 'C',
            room: '303',
            category: 'GI',
            text: 'Loose stools overnight',
            createdAt: '2026-01-03T10:00:00.000Z'
          },
          {
            id: 'n-skin',
            mrn: '301',
            residentName: 'Dan',
            unit: 'D',
            room: '304',
            category: 'Skin',
            text: 'New rash and wound drainage',
            createdAt: '2026-01-03T11:00:00.000Z'
          }
        ]
      },
      settings: {}
    };

    const recommendations = getLineListingRecommendations(db);
    expect(recommendations).toHaveLength(2);
    expect(recommendations.find(r => r.mrn === '300')?.category).toBe('gi');
    expect(recommendations.find(r => r.mrn === '301')?.category).toBe('skin');
  });

  it('maps respiratory category from ABT infection source aliases', () => {
    const db: any = {
      census: {
        residentsByMrn: {
          '200': { mrn: '200', name: 'Bob', unit: 'B', room: '202', active_on_census: true }
        }
      },
      records: {
        abx: [
          {
            id: 'abt1',
            mrn: '200',
            residentName: 'Bob',
            unit: 'B',
            room: '202',
            infection_source: 'resp',
            status: 'active',
            startDate: '2026-01-02'
          }
        ],
        line_listings: [],
        notes: []
      },
      settings: {}
    };

    const recommendations = getLineListingRecommendations(db);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].sourceType).toBe('abt');
    expect(recommendations[0].category).toBe('respiratory');
  });
});
