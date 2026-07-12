import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  listSurveyAssignments,
  markSurveyReceived,
  openWolfDb,
  saveSurveyAssignment,
  updateSurveyAssignmentStatus,
} from '../../src/storage/index.js';

test('survey assignments retain invitation identity and durable workflow state', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    await saveSurveyAssignment(db, {
      assignmentId: 'assignment-1',
      packId: 'field-report',
      recipientLabel: 'Lotus',
      surveyLabel: 'July walkthrough',
      status: 'invited',
      createdAt: '2026-07-12T10:00:00.000Z',
      updatedAt: '2026-07-12T10:00:00.000Z',
      receivedAt: null,
    });
    await markSurveyReceived(db, {
      assignmentId: 'assignment-1',
      packId: 'field-report',
      recipientLabel: 'ignored replacement',
      surveyLabel: 'ignored replacement',
    }, '2026-07-12T11:00:00.000Z');
    await updateSurveyAssignmentStatus(db, 'assignment-1', 'analyzing', '2026-07-12T12:00:00.000Z');

    const [assignment] = await listSurveyAssignments(db);
    assert.equal(assignment?.recipientLabel, 'Lotus');
    assert.equal(assignment?.status, 'analyzing');
    assert.equal(assignment?.receivedAt, '2026-07-12T11:00:00.000Z');
  } finally {
    db.close();
  }
});

test('an unrecognized returned record creates a received inbox assignment', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    await markSurveyReceived(db, {
      assignmentId: 'unexpected-record',
      packId: 'field-report',
      recipientLabel: 'Unscheduled operator',
      surveyLabel: 'Walk-in report',
    }, '2026-07-12T13:00:00.000Z');
    const [assignment] = await listSurveyAssignments(db);
    assert.equal(assignment?.status, 'received');
    assert.equal(assignment?.assignmentId, 'unexpected-record');
  } finally {
    db.close();
  }
});
