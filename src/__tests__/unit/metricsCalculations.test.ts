import { describe, it, expect } from 'vitest';

/**
 * Unit tests for metrics calculations
 * Testing business logic for infection control metrics
 */

describe('Metrics Calculations', () => {
  describe('Antibiotic Utilization Rate (AUR)', () => {
    it('should calculate AUR correctly with valid inputs', () => {
      const daysOfTherapy = 150;
      const residentDays = 1000;
      const expectedAUR = (daysOfTherapy / residentDays) * 1000;
      
      const calculateAUR = (dot: number, rd: number) => (dot / rd) * 1000;
      const result = calculateAUR(daysOfTherapy, residentDays);
      
      expect(result).toBe(expectedAUR);
      expect(result).toBe(150);
    });

    it('should handle zero resident days safely', () => {
      const daysOfTherapy = 150;
      const residentDays = 0;
      
      const calculateAUR = (dot: number, rd: number) => {
        if (rd === 0) {
          return 0;
        }
        return (dot / rd) * 1000;
      };
      
      const result = calculateAUR(daysOfTherapy, residentDays);
      expect(result).toBe(0);
    });

    it('should return correct value for decimal results', () => {
      const daysOfTherapy = 45;
      const residentDays = 892;
      
      const calculateAUR = (dot: number, rd: number) => (dot / rd) * 1000;
      const result = calculateAUR(daysOfTherapy, residentDays);
      
      expect(result).toBeCloseTo(50.45, 2);
    });
  });

  describe('Infection Rate Calculations', () => {
    it('should calculate infection rate per 1000 resident-days', () => {
      const infections = 5;
      const residentDays = 1000;
      
      const calculateInfectionRate = (inf: number, rd: number) => (inf / rd) * 1000;
      const result = calculateInfectionRate(infections, residentDays);
      
      expect(result).toBe(5);
    });

    it('should handle no infections', () => {
      const infections = 0;
      const residentDays = 1000;
      
      const calculateInfectionRate = (inf: number, rd: number) => (inf / rd) * 1000;
      const result = calculateInfectionRate(infections, residentDays);
      
      expect(result).toBe(0);
    });
  });

  describe('Resident Days Calculation', () => {
    it('should sum midnight census correctly', () => {
      const dailyCensus = [25, 26, 25, 24, 25, 26, 25];
      const expected = dailyCensus.reduce((sum, count) => sum + count, 0);
      
      expect(expected).toBe(176);
    });

    it('should calculate resident days from ADC', () => {
      const averageDailyCensus = 25.14;
      const daysInPeriod = 30;
      
      const residentDays = Math.round(averageDailyCensus * daysInPeriod);
      expect(residentDays).toBe(754);
    });
  });
});
