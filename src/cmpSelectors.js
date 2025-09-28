/**
 * Mapping of CMP IDs to arrays of CSS selectors for consent buttons.
 */
const cmpSelectors = {
  6: '.sp_choice_type_11',
  7: ['#didomi-notice-agree-button', '#cpexSubs_consentButton'],
  10: '.qc-cmp2-summary-buttons button[mode=primary]',
  28: '#onetrust-accept-btn-handler',
  31: '.cmptxt_btn_yes',
  68: '.unic-modal-content button:nth-of-type(2)',
  300: '.fc-cta-consent',
  374: '#cookiescript_accept',
  401: '.cky-notice-btn-wrapper .cky-btn-accept'
  // Add more mappings as needed
};

module.exports = cmpSelectors;
