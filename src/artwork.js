var React = require('react')
var Router = require('react-router')
var {Link} = Router
var rest = require('rest')
var humanizeNumber = require('humanize-number')
var Helmet = require('react-helmet')
var cx = require('classnames')

var ArtworkImage = require('./artwork-image')
var Markdown = require('./markdown')
var ArtworkPreview = require('./artwork-preview')
var ArtworkDetails = require('./artwork-details')
var _Artwork = require('./_artwork')
var Image = require('./image')
var imageCDN = require('./image-cdn')
var SEARCH = require('./endpoints').search
var ArtworkRelatedContent = require('./artwork-related')

var Sticky = require('react-sticky')

var Artwork = React.createClass({
  mixins: [Router.State],
  statics: {
    fetchData: {
      artwork: (params, existingData) => {
        if(existingData && existingData.id && existingData.id == params.id) return Promise.resolve(existingData)
        return rest(`${SEARCH}/id/`+params.id)
        .then((r) => JSON.parse(r.entity))
        .then(art => {
          art.slug = _Artwork.slug(art)
          return art
        })
      },
    },

    willTransitionTo: function (transition, params, query, callback) {
      var existingArt = window.__DATA__ && window.__DATA__.artwork
      Artwork.fetchData.artwork(params, existingArt).then(art => {
        window.__DATA__ = {artwork: art}
        if(art.slug !== params.slug) {
          params.slug = art.slug
          transition.redirect('artworkSlug', params)
        }
      }).then(callback)
    }
  },

  render() {
    var art = this.state.art
    var id = this.props.id || this.state.id
    const highlights = this.props.highlights
    var stickyMapStyle = this.context.universal ? {position: 'fixed'} : {}
    var smallViewport = window && window.innerWidth <= 500

    var pageTitle = [
      art.title.replace(/<[^ ]+?>/g, '"'),
      _Artwork.Creator.getFacetAndValue(art)[1]
    ].filter(e => e).join(', ')
    var imageUrl = imageCDN(id)
    var canonicalURL = `http://collections.artsmia.org/art/${art.id}/${art.slug}`

    var image = <Image art={art}
      style={{width: 400, height: 400, maxWidth: '100%'}}
      ignoreStyle={true} />

    var aspectRatio = art.image_width/art.image_height
    var mapHeight = art.image == "valid" ?
      Math.max(40, Math.min(65, 1/aspectRatio*80)) :
      20

    var showMoreIcon = Object.keys(art).filter(key => key.match(/related:/) && !key.match(/related:exhibitions/)).length > 0 &&
      !this.state.fullscreenImage
    var exploreIcon = showMoreIcon && <a href="#explore" style={{position: 'absolute', zIndex: '10000', right: '7px', bottom: '0px'}}>
      <img src="/images/more-icon.svg" style={{width: '3em'}}/>
    </a>

    var mapStyle = smallViewport ?
      {width: '100%', display: 'inline-block', height: mapHeight+'vh'} :
      stickyMapStyle

    var {zoomLoaded} = this.state
    var zoomLoadedSuccessfully = zoomLoaded && zoomLoaded !== 'error'

    var map = <div ref='map' id='map' style={mapStyle}>
      {zoomLoadedSuccessfully || (art.image == 'valid' && art.rights !== 'Permission Denied') && <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', WebkitTransform: 'translate(-50%, -50%)', width: '100%', textAlign: 'center'}}>
        {image}
        {art.image_copyright && <p style={{fontSize: '0.8em'}}>{decodeURIComponent(art.image_copyright)}</p>}
      </div> || <NoImagePlaceholder />}
      {this.imageStatus()}
      {smallViewport && exploreIcon}
    </div>

    var info = <div className='info'>
      <ArtworkPreview art={art} showLink={false} showDuplicateDetails={true} />
      <div className="back-button"><a href="#" onClick={() => history.go(-1)}><i className="material-icons">arrow_back</i> back</a></div>
      <ArtworkRelatedContent id={id} art={art} />
      <div>
        <h5 className='details-title'>Details</h5>
        <ArtworkDetails art={art} />
      </div>
    </div>

    var content
    if(smallViewport) {
      content = <div>
        {map}
        {info}
      </div>
    } else {
      content = <div>
        {info}

        <Sticky
          stickyStyle={{position: 'fixed', height: '100%', width: '65%', top: 0, transform: 'translate3d(0px,0px,0px)'}}
          onStickyStateChange={this.resizeMap}>
          {map}
        </Sticky>
      </div>
    }

    return <div className={cx('artwork', {smallviewport: smallViewport})}>
      {content}
      <Helmet
        title={pageTitle}
        meta={[
          {property: "og:title", content: pageTitle + ' ^ Minneapolis Institute of Art'},
          {property: "og:description", content: art.text},
          {property: "og:image", content: imageUrl},
          {property: "og:url", content: canonicalURL},
          {property: "twitter:card", content: "summary_large_image"},
          {property: "twitter:site", content: "@artsmia"},
          {property: "robots", content: this.isLoan() ? 'noindex' : 'all'},
        ]}
        link={[
          {"rel": "canonical", "href": canonicalURL},
        ]}
        />
    </div>
  },

  getInitialState() {
    var art = this.props.data.artwork
    art.id = this.props.id || art.id.replace('http://api.artsmia.org/objects/', '')

    return {
      art: art,
      id: art.id,
      fullscreenImage: false,
    }
  },

  componentDidMount() {
    var art = this.state.art
    if(art.image === 'valid' && art.restricted != 1 && !this.isLoan()) this.loadZoom()
    var smallViewport = window && window.innerWidth <= 500
    // push the viewport down past the header to maximize image/text on the page
    // scrolling back up reveals the menu
    // TODO: is there a way to automatically trigger safari's minimal chrome other than a user-initiated scroll event? (probably not https://stackoverflow.com/a/26884561)
    if(smallViewport && window.scrollX == 0) setTimeout(() => window.scrollTo(0, 56), 0)
  },

  loadZoom() {
    var L = require('museum-tile-layer')
    var fullscreen = require('leaflet-fullscreen')

    var art = this.state.art
    this.setState({zoomLoaded: false, zoomLoading: true})

    rest(`//tiles.dx.artsmia.org/${this.state.id}.json`)
    .then(
      response => JSON.parse(response.entity),
      rejected => {
        // TODO: log this somewhere
        this.setState({zoomLoaded: 'error'})
        return Promise.reject(new Error(`can't load tiles for ${art.id}`))
      }
    )
    .then((data) => {
      this.map = L.map(this.refs.map.getDOMNode(), {
        crs: L.CRS.Simple,
        zoomControl: false,
      })
      this.map.attributionControl.setPrefix('')
      this.map.setView([art.image_width/2, art.image_height/2], 0)
      if(!L.Browser.touch) new L.Control.Zoom({ position: 'topright' }).addTo(this.map)
      new L.Control.Fullscreen({
        position: 'topright',
        pseudoFullscreen: true,
      }).addTo(this.map)

      this.tiles = L.museumTileLayer('http://{s}.tiles.dx.artsmia.org/{id}/{z}/{x}/{y}.png', {
        attribution: art.image_copyright ? decodeURIComponent(art.image_copyright) : '',
        id: this.state.id,
        width: data.width,
        height: data.height,
        tileSize: data.tileSize || 256,
      })
      this.tiles.addTo(this.map)

      // this.tiles.fillContainer()
      this.setState({zoomLoading: false, zoomLoaded: true})
      this.map.on('fullscreenchange', () => {
        this.setState({fullscreenImage: !this.state.fullscreenImage})
        this.props.toggleAppHeader()
      })
      var zoomCount, zoomInCount, zoomOutCount, prevZoom, nowZoom;
      var zoomCount = zoomInCount = zoomOutCount = 0;
      var prevZoom = nowZoom = this.map.getZoom();
      var recentlyAutoZoomed = false;

      this.map.on('zoomstart zoomend', (event) => {
        [prevZoom, nowZoom] = [nowZoom, this.map.getZoom()]
        zoomCount += 1
        nowZoom > prevZoom ? zoomInCount += 1 : zoomOutCount += 1

        var smallViewport = window && window.innerWidth <= 500
        var isSecondZoomInAction = zoomInCount == 2
        if(smallViewport && !recentlyAutoZoomed) {
          // fullscreen the image when a user zooms twice in a row
          // leave fullscreen when they return to minZoom
          // mobile-only for now
          var reasonsToChangeFullscreen = [
            event.type == 'zoomstart' && zoomInCount == 2 && !this.map.isFullscreen(), // zooming in when not fullscreen
            event.type == 'zoomend' && nowZoom >= 3 && !this.map.isFullscreen(), // not fullscreen and zoomed in quite far
            event.type == 'zoomend' && this.map.getZoom() == this.map.getMinZoom() && this.map.isFullscreen(), // in fullscreen, zooming out to minZoom
          ]
          if(reasonsToChangeFullscreen.find(reason => reason)) { // if any of the valid reasons evaluate to true
            this.map.toggleFullscreen({pseudoFullscreen: true})
            recentlyAutoZoomed = true
            clearTimeout(this.zoomCountResetTimer)
            this.zoomCountResetTimer = setTimeout(() => { zoomCount = zoomInCount = zoomOutCount = 0; recentlyAutoZoomed = false }, 1000)
          }
        }
      })
    })
    .catch(err => this.setState({zoomLoading: false}))
  },

  resizeMap() {
    if(this.map && this.tiles) {
      this.map.invalidateSize()
      this.tiles.fitBoundsExactly()
    }
  },

  imageStatus() {
    var {art, zoomLoaded, zoomLoading} = this.state
    var copyrightAndOnViewMessage = art.room[0] == 'G' ? " (You'll have to come see it in person.)" : ''
    var loadingZoomMessage =  `
      (—Is that the best image you've got!!?
      —Nope! We're loading ${humanizeNumber(this.getPixelDifference(400))} more pixels right now.
      It can take a few seconds.)`
    var showLoadingMessage = zoomLoading && zoomLoaded === false && !this.context.universal
    var showErrorMessage = zoomLoaded === 'error'
    var smallViewport = window && window.innerWidth <= 500

    return art.image === 'valid' && <span className="imageStatus">
      {showLoadingMessage && loadingZoomMessage}
      {showErrorMessage && <p>Error loading high resolution image. <a href="mailto:collectionsdata+images@artsmia.org">Report this problem</a>.</p>}
      {art.restricted === 1 && !smallViewport && "Because of © restrictions, we can only show you a small image of this artwork." + copyrightAndOnViewMessage}
    </span>
  },

  calculateImagePixelSize(size) {
    var {image_width, image_height} = this.state.art
    var maxDimension = Math.max(image_width, image_height)
    var size = size || maxDimension
    var ratio = Math.floor(maxDimension/size)

    return Math.floor(image_width/ratio) * Math.floor(image_height/ratio)
  },

  // how many more pixels are in the full sized image than the given thumbnail?
  getPixelDifference(size=400) {
    return Math.floor(
      this.calculateImagePixelSize() - this.calculateImagePixelSize(400)
    )
  },

  isLoan() {
    return this.state.art.accession_number.match(/^L/i)
  },
})
Artwork.contextTypes = {
  router: React.PropTypes.func,
  universal: React.PropTypes.bool,
}

var noImageStyle = {
  wrapper: {
    "position": 'absolute',
    "top": '50%',
    "left": '50%',
    "transform": 'translate(-50%, -50%)',
    "WebkitTransform": 'translate(-50%, -50%)',
    "width": '77%',
    "textAlign": 'center',
  },
  pattern: {
  }
}
var NoImagePlaceholder = React.createClass({
  render() {
    return <div style={noImageStyle.wrapper}>
      <div className="noImage invalid"><p>No Image Available</p></div>
    </div>
  }
})

module.exports = Artwork
