import { useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CAMPUSES, findCampus } from '../utils/studentBrowsing.js';

export const StudentDemoNotice = () => (
  <aside className="student-demo-notice" aria-label="Demo browsing information">
    <span className="student-demo-badge">Demo browsing</span>
    <div>
      <p><strong>Sample restaurants and menus.</strong> These are synthetic examples, not real partners. Ordering and delivery are not available.</p>
      <p>Planned delivery is restaurant-managed, with cash on delivery in ETB. Distance-based fees will be strictly below 100 ETB; exact fees are not set.</p>
    </div>
  </aside>
);

export const CampusSelect = ({ selectRef }) => {
  const [params, setParams] = useSearchParams();
  const id = useId();
  const rawCampus = params.get('campus') || '';
  const campus = findCampus(rawCampus);
  const invalid = Boolean(rawCampus && !campus);
  return (
    <div className="student-campus-panel">
      <div><label htmlFor={`${id}-campus`}>Your campus</label><p id={`${id}-help`}>Choose where you’d like to browse sample menus.</p></div>
      <div className="student-campus-control">
        <select ref={selectRef} id={`${id}-campus`} name="campus" value={campus?.id || ''} aria-invalid={invalid} aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ''}`}
          onChange={(event) => { const next = new URLSearchParams(params); next.set('campus', event.target.value); setParams(next); }}>
          <option value="" disabled>Choose your campus</option>
          {CAMPUSES.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
        {invalid && <p id={`${id}-error`} className="error-text" role="alert">This campus isn’t supported. Choose one of the four campuses above.</p>}
      </div>
    </div>
  );
};

CampusSelect.propTypes = {
  selectRef: (props) => props.selectRef != null && typeof props.selectRef !== 'object' ? new Error('Campus selection requires an element ref.') : null,
};

export const CampusCoverage = ({ campusIds }) => (
  <div className="student-coverage"><span>Sample campus coverage</span><ul aria-label="Supported campuses">
    {campusIds.map((id) => <li key={id}>{findCampus(id)?.name || 'Unknown campus'}</li>)}
  </ul></div>
);

CampusCoverage.propTypes = {
  campusIds: (props) => !Array.isArray(props.campusIds) ? new Error('Campus coverage requires campus IDs.') : null,
};
