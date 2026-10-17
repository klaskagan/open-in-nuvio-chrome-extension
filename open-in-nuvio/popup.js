(() => {
  const S = globalThis.NuvioSettings;
  const status = document.getElementById('status');
  let revision = 0;
  const shortcut = document.getElementById('shortcut-value');
  chrome.commands
    ?.getAll?.()
    .then((items) => {
      shortcut.textContent =
        items.find((x) => x.name === 'open-current-nuvio')?.shortcut || 'Not assigned';
    })
    .catch(() => {
      shortcut.textContent = 'Configure in Chrome';
    });
  document.getElementById('configure-shortcut').onclick = () =>
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  const fields = [
    'enabled',
    'appearance',
    'contextMenu',
    'autoLaunch',
    'linkTarget',
    'traktControls',
  ];
  document.getElementById('brand-icon').src = globalThis.NuvioButtonIcon;
  document.getElementById('version').textContent =
    'v' + (globalThis.chrome?.runtime?.getManifest?.().version || '1.4.0');
  function appearance() {
    document.body.classList.toggle('paused', !document.getElementById('enabled').checked);
    for (const input of document.querySelectorAll('[data-site]'))
      input
        .closest('.site')
        .querySelector('.choices')
        .classList.toggle('is-muted', !input.checked);
  }
  function render(value) {
    for (const key of fields) {
      const el = document.getElementById(key);
      if (el.type === 'checkbox') el.checked = value[key];
      else el.value = value[key];
    }
    for (const el of document.querySelectorAll('[data-site]'))
      el.checked = value.sites[el.dataset.site];
    for (const el of document.querySelectorAll('[data-site-button]')) {
      const [site, name] = el.dataset.siteButton.split('.');
      el.checked = value.buttons[site][name];
    }
    appearance();
  }
  function collect() {
    const value = S.get();
    for (const key of fields) {
      const el = document.getElementById(key);
      value[key] = el.type === 'checkbox' ? el.checked : el.value;
    }
    for (const el of document.querySelectorAll('[data-site]'))
      value.sites[el.dataset.site] = el.checked;
    for (const el of document.querySelectorAll('[data-site-button]')) {
      const [site, name] = el.dataset.siteButton.split('.');
      value.buttons[site][name] = el.checked;
    }
    return value;
  }
  async function save() {
    const request = ++revision;
    appearance();
    status.textContent = 'Saving…';
    status.classList.remove('error');
    try {
      await S.save(collect());
      if (request === revision) status.textContent = 'Saved';
    } catch (error) {
      if (request === revision) {
        status.textContent = 'Could not save';
        status.title = error.message;
        status.classList.add('error');
      }
    }
  }
  document.getElementById('settings').addEventListener('change', save);
  document.getElementById('enabled').addEventListener('change', save);
  document.getElementById('reset').onclick = async () => {
    const request = ++revision;
    status.textContent = 'Resetting…';
    try {
      const value = await S.reset();
      if (request === revision) {
        render(value);
        status.textContent = 'Defaults restored';
        status.classList.remove('error');
      }
    } catch {
      status.textContent = 'Could not reset';
      status.classList.add('error');
    }
  };
  S.ready.then(() => {
    render(S.get());
    document.getElementById('fields').disabled = false;
    document.getElementById('enabled').disabled = false;
    document.getElementById('reset').disabled = false;
    status.textContent = S.loadError ? 'Using defaults' : 'All changes saved';
    status.classList.toggle('error', Boolean(S.loadError));
  });
  document.getElementById('enabled').disabled = true;
})();
