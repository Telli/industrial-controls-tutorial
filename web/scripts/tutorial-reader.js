// Share the site's theme without changing the original tutorial interactions.
(() => {
  const key = 'industrial-lab-theme'
  let theme = 'light'
  try { theme = localStorage.getItem(key) === 'dark' ? 'dark' : 'light' } catch {}
  document.documentElement.dataset.theme = theme
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('course-theme-toggle')
    const render = () => {
      button.textContent = theme === 'light' ? 'Dark theme' : 'Light theme'
      button.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`)
    }
    render()
    button.addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light'
      document.documentElement.dataset.theme = theme
      try { localStorage.setItem(key, theme) } catch {}
      render()
    })
  })
})()
