import { APP_CONFIG } from './config.js';

function emptyUsage(){
  return { requests:0, inputTokens:0, outputTokens:0, totalTokens:0, estimatedInputTokens:0 };
}

export function createDefaultState() {
  return {
    version: APP_CONFIG.version,
    mode: 'new',
    appendices: { pl1: true, pl2: true, pl3: true },
    project: {
      academicYear: APP_CONFIG.academicYearDefault,
      grade: 8,
      subject: 'Ngữ văn',
      totalPeriods: APP_CONFIG.totalPeriodsDefault,
      semester1Periods: APP_CONFIG.semester1Default,
      semester2Periods: APP_CONFIG.semester2Default,
      deviceMode: 'teacher-only'
    },
    school: {
      officialName: '',
      department: 'Tổ Ngữ văn',
      locality: '',
      organizationMode: 'single',
      totalClassesManual: '',
      totalStudentsManual: '',
      sites: [
        { id: crypto.randomUUID(), type: 'MAIN_CAMPUS', name: 'Trụ sở chính', locality: '', classCount: '', studentCount: '', note: '' }
      ]
    },
    pl1: {
      staff: { total: '', college: '', university: '', postgraduate: '', good: '', fair: '', pass: '', fail: '' },
      equipment: [],
      facilities: []
    },
    pl2: { activities: [] },
    pl3: {
      teacherName: '',
      assignments: [],
      defaultEquipment: 'Laptop; Tivi/máy chiếu; Phiếu học tập',
      defaultLocation: 'Lớp học',
      otherTasks: ''
    },
    ai: {
      provider: 'gemini',
      model: '',
      modelInfo: null,
      apiKey: '',
      consentGiven: false
    },
    options: {
      integrateNls: true,
      integrateQpan: true,
      reviewYccd: false,
      reviewCurriculum: false,
      reviewPeriods: false,
      reviewEquipment: false,
      normalizeNghiDinh30: true
    },
    documents: [],
    curriculum: [],
    assessments: [],
    aiSuggestions: [],
    warnings: [],
    validation: { errors: [], warnings: [], passed: [] },

    // v1.2.2: checkpoint dùng chung cho Text Pipeline và Native PDF Pipeline.
    analysis: {
      textbook: {
        fingerprint: '',
        pipeline: '', // text|native_pdf|mixed
        status: 'idle', // idle|prepared|running|paused|completed|partial|failed
        pauseRequested: false,
        chunks: [],
        compactedSummaries: [],
        total: 0,
        completed: 0,
        failed: 0,
        currentChunkId: '',
        startedAt: '',
        finishedAt: '',
        usage: emptyUsage(),
        lastError: ''
      },
      existing: {
        status: 'idle',
        chunks: [],
        usage: emptyUsage()
      }
    },

    meta: {
      curriculumSource: 'AI_DRAFT',
      lastUpdated: new Date().toISOString()
    }
  };
}
