import { useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Search, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/dashboard/SectionCard';

type PrecautionMatch = {
  title: string;
  protocol: 'EBP' | 'Contact' | 'Droplet' | 'Airborne' | 'Standard';
  description: string;
  examples: string[];
};

type ReferenceItem = {
  title: string;
  organization: string;
  category: string;
  description: string;
  url: string;
  tags: string[];
};

const PRECAUTION_RULES: { match: PrecautionMatch; keywords: string[] }[] = [
  {
    match: {
      title: 'Enhanced Barrier Precautions (EBP)',
      protocol: 'EBP',
      description:
        'Recommended for residents with wounds needing dressings, indwelling devices, or known MDRO colonization/infection when full Contact Precautions are not required.',
      examples: [
        'Any wound with routine dressing care',
        'Indwelling urinary catheter (Foley/suprapubic)',
        'Nephrostomy tube (if used)',
        'Feeding tube (PEG/GJ/J-tube)',
        'Tracheostomy or ventilator-dependent',
        'Central line (PICC/tunneled/port access)',
        'Known MDRO (MRSA/VRE/ESBL/CRE)',
      ],
    },
    keywords: [
      'indwelling catheter',
      'indwelling device',
      'foley catheter',
      'suprapubic catheter',
      'urinary catheter',
      'nephrostomy',
      'nephrostomy tube',
      'central line',
      'central venous catheter',
      'picc',
      'tunneled central line',
      'port accessed',
      'port access',
      'central catheter',
      'vascular access',
      'tracheostomy',
      'trach',
      'ventilator',
      'mechanical ventilation',
      'ventilator-dependent',
      'feeding tube',
      'g-tube',
      'g tube',
      'peg tube',
      'gastrostomy tube',
      'gj tube',
      'g j tube',
      'j tube',
      'jejunal tube',
      'enteral feeding',
      'enteral tube',
      'wound',
      'open wound',
      'pressure injury',
      'pressure ulcer',
      'surgical wound',
      'venous stasis ulcer',
      'diabetic foot ulcer',
      'neuropathic ulcer',
      'skin tear',
      'dressing',
      'draining wound',
      'abscess',
      'dressing change',
      'dressing changes',
      'mdro',
      'mrsa',
      'vre',
      'esbl',
      'cre',
      'colonization',
      'mdro colonization',
    ],
  },
  {
    match: {
      title: 'Contact Precautions',
      protocol: 'Contact',
      description:
        'Use gown and gloves for direct contact or care of the environment, especially with uncontained drainage, diarrhea, or uncontrolled secretions.',
      examples: [
        'C. diff with diarrhea',
        'Draining wound not contained',
        'Uncontrolled secretions',
        'Scabies',
        'Norovirus',
      ],
    },
    keywords: [
      'c. diff',
      'c diff',
      'clostridioides difficile',
      'diarrhea',
      'draining wound',
      'uncontained drainage',
      'uncontrolled secretions',
      'scabies',
      'norovirus',
      'mrsa',
      'vre',
      'mdro',
      'esbl',
    ],
  },
  {
    match: {
      title: 'Droplet Precautions',
      protocol: 'Droplet',
      description: 'Use surgical mask for close contact and eye protection as indicated.',
      examples: ['COVID-19', 'Influenza', 'RSV'],
    },
    keywords: ['covid', 'sars-cov-2', 'influenza', 'flu', 'rsv', 'adenovirus'],
  },
  {
    match: {
      title: 'Airborne Precautions',
      protocol: 'Airborne',
      description: 'Use N95 and negative pressure room when indicated.',
      examples: ['Tuberculosis', 'Measles', 'Varicella'],
    },
    keywords: ['tuberculosis', 'tb', 'measles', 'varicella', 'chickenpox'],
  },
];

const REFERENCE_LIBRARY: ReferenceItem[] = [
  {
    title: 'CDC Infection Control Guidelines for Healthcare Settings',
    organization: 'CDC',
    category: 'Infection Control',
    description: 'Core guidance for standard and transmission-based precautions.',
    url: 'https://www.cdc.gov/infectioncontrol/guidelines/index.html',
    tags: ['standard precautions', 'transmission-based', 'ppe'],
  },
  {
    title: 'CDC Core Elements of Infection Prevention and Control',
    organization: 'CDC',
    category: 'Infection Control',
    description: 'Foundational infection prevention program elements for healthcare facilities.',
    url: 'https://www.cdc.gov/infectioncontrol/guidelines/core-elements/index.html',
    tags: ['program', 'ipc', 'facility'],
  },
  {
    title: 'CDC Core Elements of Antibiotic Stewardship for Nursing Homes',
    organization: 'CDC',
    category: 'Antibiotic Stewardship',
    description: 'Stewardship checklist and implementation guidance for LTC.',
    url: 'https://www.cdc.gov/antibiotic-use/core-elements/nursing-homes.html',
    tags: ['antibiotic stewardship', 'F881', 'stewardship'],
  },
  {
    title: 'CMS Infection Control Surveyor Guidance (F880)',
    organization: 'CMS',
    category: 'Infection Control',
    description: 'Regulatory guidance for infection prevention and control in nursing homes.',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/surveycertificationgeninfo/policy-and-memos-to-states-and-regions',
    tags: ['cms', 'f880', 'survey'],
  },
  {
    title: 'CMS Antibiotic Stewardship Requirements (F881)',
    organization: 'CMS',
    category: 'Antibiotic Stewardship',
    description: 'Regulatory expectations for antibiotic stewardship programs.',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/surveycertificationgeninfo/policy-and-memos-to-states-and-regions',
    tags: ['cms', 'f881', 'stewardship'],
  },
  {
    title: 'NYS DOH Infection Control & Prevention Resources',
    organization: 'NYS DOH',
    category: 'Infection Control',
    description: 'State-level infection prevention, reporting, and guidance resources.',
    url: 'https://www.health.ny.gov/professionals/diseases/communicable/',
    tags: ['nys doh', 'reporting', 'communicable disease'],
  },
  {
    title: 'NYS DOH Antibiotic Stewardship Resources',
    organization: 'NYS DOH',
    category: 'Antibiotic Stewardship',
    description: 'State stewardship initiatives, reporting, and education.',
    url: 'https://www.health.ny.gov/professionals/antibiotic_resistance/',
    tags: ['nys doh', 'stewardship', 'antibiotic resistance'],
  },
  {
    title: 'CDC Vaccines & Immunizations',
    organization: 'CDC',
    category: 'Vaccination',
    description: 'Recommendations, schedules, and vaccine resources for healthcare providers.',
    url: 'https://www.cdc.gov/vaccines/index.html',
    tags: ['immunization', 'schedule', 'vaccines'],
  },
  {
    title: 'CDC Adult Immunization Schedule',
    organization: 'CDC',
    category: 'Vaccination',
    description: 'Annual adult immunization schedules and clinical resources.',
    url: 'https://www.cdc.gov/vaccines/schedules/hcp/imz/adult.html',
    tags: ['adult', 'schedule', 'vaccination'],
  },
  {
    title: 'CMS COVID-19 Vaccination Requirements for LTC',
    organization: 'CMS',
    category: 'Vaccination',
    description: 'Guidance for COVID-19 vaccination compliance and reporting.',
    url: 'https://www.cms.gov/coronavirus/covid-19-nursing-home-data',
    tags: ['cms', 'covid-19', 'vaccination'],
  },
];

const normalizeQuery = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9\\s.-]/g, '').replace(/\\s+/g, ' ').trim();

const ReferenceLibraryView = () => {
  const [referenceQuery, setReferenceQuery] = useState('');
  const [precautionQuery, setPrecautionQuery] = useState('');

  const filteredReferences = useMemo(() => {
    const normalized = normalizeQuery(referenceQuery);
    if (!normalized) return REFERENCE_LIBRARY;
    return REFERENCE_LIBRARY.filter((item) => {
      const haystack = `${item.title} ${item.organization} ${item.category} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [referenceQuery]);

  const precautionMatches = useMemo(() => {
    const normalized = normalizeQuery(precautionQuery);
    if (!normalized) return [];
    return PRECAUTION_RULES.filter((rule) =>
      rule.keywords.some((keyword) => normalized.includes(keyword)),
    ).map((rule) => rule.match);
  }, [precautionQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-2xl font-bold text-foreground">Reference Library</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Search CDC, CMS, and NYS DOH guidance for infection control, antibiotic stewardship, and vaccination.
        </p>
      </div>

      <SectionCard
        title="Precaution Quick Check"
        actions={
          <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
            Detection Assist
          </Badge>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search className="w-4 h-4" />
              Search a disease, device, or organism
            </div>
            <Input
              placeholder="Example: Foley catheter, C. diff, MRSA, COVID, influenza"
              value={precautionQuery}
              onChange={(event) => setPrecautionQuery(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Matches return recommended precautions for quick review. Always verify with official guidance.
            </p>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            {precautionMatches.length > 0 ? (
              precautionMatches.map((match) => (
                <div key={match.title} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-warning" />
                    <div>
                      <p className="text-sm font-semibold">{match.title}</p>
                      <p className="text-xs text-muted-foreground">{match.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {match.examples.map((example) => (
                      <Badge key={example} variant="outline" className="text-[11px]">
                        {example}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Standard Precautions</p>
                  <p className="text-xs text-muted-foreground">
                    No enhanced or isolation precautions detected. Continue standard precautions and verify as needed.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Guideline Library"
        actions={
          <div className="flex items-center gap-2">
            <Input
              className="h-8 w-64"
              placeholder="Search references"
              value={referenceQuery}
              onChange={(event) => setReferenceQuery(event.target.value)}
            />
            <Button variant="outline" size="sm">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredReferences.map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.organization}</p>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {item.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] uppercase tracking-wide">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="w-full justify-between">
                <a href={item.url} target="_blank" rel="noreferrer">
                  View guideline
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          ))}
        </div>
        {filteredReferences.length === 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            No references match that search. Try broader terms like “vaccination” or “stewardship”.
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default ReferenceLibraryView;
