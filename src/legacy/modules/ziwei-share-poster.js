function drawRoundedPath(ctx, x, y, w, h, r) {
  var radius = Math.max(0, Number(r) || 0)
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawGlow(ctx, x, y, r, color) {
  var g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export function renderZiweiSharePoster(options) {
  var posterSpec = options.posterSpec || null
  var shareLink = String(options.shareLink || '')
  var posterW = posterSpec ? Number(posterSpec.posterWidth || 1200) : 1200
  var posterH = posterSpec ? Number(posterSpec.posterHeight || 1880) : 1880
  var canvas = document.createElement('canvas')
  canvas.width = posterW
  canvas.height = posterH
  var ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('海报画布创建失败')

  var bg = ctx.createLinearGradient(0, 0, posterW, posterH)
  var bgStops = posterSpec && Array.isArray(posterSpec.backgroundStops) ? posterSpec.backgroundStops : [
    { offset: 0, color: '#060d1f' },
    { offset: 0.52, color: '#0b1531' },
    { offset: 1, color: '#111f44' }
  ]
  bgStops.forEach(function(stop) {
    bg.addColorStop(Number((stop && stop.offset) || 0), String((stop && stop.color) || '#060d1f'))
  })
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, posterW, posterH)

  var glowList = posterSpec && Array.isArray(posterSpec.glows) ? posterSpec.glows : [
    { x: 190, y: 240, radius: 320, color: 'rgba(79,125,249,.32)' },
    { x: 1020, y: 360, radius: 360, color: 'rgba(95,180,255,.2)' },
    { x: 640, y: 1520, radius: 420, color: 'rgba(139,92,246,.24)' }
  ]
  glowList.forEach(function(glow) {
    drawGlow(
      ctx,
      Number((glow && glow.x) || 0),
      Number((glow && glow.y) || 0),
      Number((glow && glow.radius) || 0),
      String((glow && glow.color) || 'rgba(0,0,0,0)')
    )
  })

  ctx.fillStyle = 'rgba(255,255,255,.08)'
  var gridStep = posterSpec ? Number(posterSpec.gridStep || 36) : 36
  for (var gx = 0; gx <= posterW; gx += gridStep) ctx.fillRect(gx, 0, 1, posterH)
  for (var gy = 0; gy <= posterH; gy += gridStep) ctx.fillRect(0, gy, posterW, 1)

  ctx.fillStyle = '#c8d8ff'
  ctx.font = '600 24px "JetBrains Mono","Noto Sans SC",monospace'
  ctx.fillText(posterSpec ? String(posterSpec.eyebrow || '') : 'Z I W E I  D O U  S H U', 84, 118)

  ctx.fillStyle = '#edf2ff'
  ctx.font = '700 78px "Noto Sans SC","PingFang SC",sans-serif'
  ctx.fillText(posterSpec ? String(posterSpec.title || '') : '紫微斗数命盘', 84, 212)

  ctx.fillStyle = 'rgba(214,226,255,.9)'
  ctx.font = '500 34px "Noto Sans SC","PingFang SC",sans-serif'
  ctx.fillText(
    posterSpec ? String(posterSpec.subtitle || '') : '专业排盘 + AI 深度解读 + 一键分享',
    84,
    266
  )

  var featureCards = posterSpec && Array.isArray(posterSpec.featureCards) ? posterSpec.featureCards : []
  var cardX = 78
  var cardY = 334
  var cardW = posterW - cardX * 2
  var cardH = 216
  for (var fi = 0; fi < featureCards.length; fi++) {
    var item = featureCards[fi]
    var y = cardY + fi * (cardH + 20)
    ctx.fillStyle = 'rgba(10,20,45,.74)'
    ctx.strokeStyle = 'rgba(129,140,248,.3)'
    ctx.lineWidth = 2
    drawRoundedPath(ctx, cardX, y, cardW, cardH, 18)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = item.color
    ctx.beginPath()
    ctx.arc(cardX + 40, y + 44, 14, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f2f6ff'
    ctx.font = '700 40px "Noto Sans SC","PingFang SC",sans-serif'
    ctx.fillText(item.title, cardX + 72, y + 58)
    ctx.fillStyle = 'rgba(202,216,248,.95)'
    ctx.font = '500 30px "Noto Sans SC","PingFang SC",sans-serif'
    ctx.fillText(item.desc, cardX + 72, y + 116)
  }

  ctx.fillStyle = 'rgba(255,255,255,.86)'
  ctx.font = '600 32px "Noto Sans SC","PingFang SC",sans-serif'
  ctx.fillText(posterSpec ? String(posterSpec.shareEntryTitle || '') : '体验入口', 84, 1338)

  ctx.fillStyle = 'rgba(15,24,52,.82)'
  ctx.strokeStyle = 'rgba(129,140,248,.45)'
  ctx.lineWidth = 2
  drawRoundedPath(ctx, 84, 1368, posterW - 168, 184, 16)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#d6e3ff'
  ctx.font = '500 27px "JetBrains Mono","Noto Sans SC",monospace'
  var linkText = posterSpec
    ? String(posterSpec.shareLinkDisplay || shareLink)
    : (shareLink.length > 74 ? shareLink.slice(0, 74) + '...' : shareLink)
  ctx.fillText(linkText, 116, 1452)

  ctx.fillStyle = 'rgba(178,196,233,.95)'
  ctx.font = '500 26px "Noto Sans SC","PingFang SC",sans-serif'
  ctx.fillText(
    posterSpec ? String(posterSpec.shareEntryDescription || '') : '扫码或打开链接，即可进入命盘界面体验完整功能',
    116,
    1506
  )

  ctx.fillStyle = '#f8fbff'
  ctx.font = '700 30px "Noto Sans SC","PingFang SC",sans-serif'
  ctx.fillText(posterSpec ? String(posterSpec.footerTitle || '') : 'SQLDev × 紫微斗数工具', 84, 1718)
  ctx.fillStyle = 'rgba(199,214,247,.88)'
  ctx.font = '500 22px "JetBrains Mono","Noto Sans SC",monospace'
  ctx.fillText(posterSpec ? String(posterSpec.footerSubtitle || '') : 'AI Powered Professional Charting Platform', 84, 1760)

  return canvas.toDataURL('image/png')
}

export function downloadZiweiSharePosterDataUrl(dataUrl) {
  if (!dataUrl) return
  var link = document.createElement('a')
  link.href = dataUrl
  link.download = 'ziwei-share-poster.png'
  link.click()
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_ZIWEI_SHARE_POSTER = {
    renderZiweiSharePoster,
    downloadZiweiSharePosterDataUrl
  }
}
