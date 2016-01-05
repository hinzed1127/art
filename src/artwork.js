var React = require('react')
var Router = require('react-router')
var rest = require('rest')
var humanizeNumber = require('humanize-number')
var Helmet = require('react-helmet')

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
      artwork: (params) => {
        return rest(`${SEARCH}/id/`+params.id)
        .then((r) => JSON.parse(r.entity))
        .then(art => {
          art.slug = _Artwork.slug(art)
          return art
        })
      },

      relatedContent: ArtworkRelatedContent.fetchData,
    },

    willTransitionTo: function (transition, params, query, callback) {
      Artwork.fetchData.artwork(params).then(art => {
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

    var pageTitle = [art.title, _Artwork.Creator.getFacetAndValue(art)[1]].filter(e => e).join(', ')
    var imageUrl = imageCDN(id)
    var canonicalURL = `http://collections.artsmia.org/art/${art.id}/${art.slug}`

    var image = <Image art={art}
      style={{width: 400, height: 400}}
      ignoreStyle={true} />

    if(smallViewport) {
      return (
        <div className='artwork smallviewport'>
          <div ref='map' id='map' style={{width: '100%', display: 'inline-block'}}>
            {this.state.zoomLoaded || art.image == 'valid' && <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', WebkitTransform: 'translate(-50%, -50%)'}}>
              {image}
              {art.image_copyright && <p style={{fontSize: '0.8em'}}>{decodeURIComponent(art.image_copyright)}</p>}
            </div>}
            {this.imageStatus()}
          </div>
          <div className='info'>
            <ArtworkPreview art={art} showLink={false} />
            <div className="back-button"><a href="#" onClick={() => history.go(-1)}><i className="material-icons">arrow_back</i> back</a></div>
            <ArtworkRelatedContent id={id} links={this.props.data.relatedContent} />
            <ArtworkDetails art={art} />
          </div>
          <Helmet
            title={pageTitle}
            meta={[
              {property: "og:title", content: pageTitle + ' ^ Minneapolis Institute of Art'},
              {property: "og:description", content: art.text},
              {property: "og:image", content: imageUrl},
              {property: "og:url", content: canonicalURL},
              {property: "twitter:card", content: "summary_large_image"},
              {property: "twitter:site", content: "@artsmia"},
            ]}
            link={[
              {"rel": "canonical", "href": canonicalURL},
            ]}
            />
        </div>
      )
    } else {
      return (
        <div className='artwork'>
          <div className='info'>
            <ArtworkPreview art={art} showLink={false} />
            <div className="back-button"><a href="#" onClick={() => history.go(-1)}><i className="material-icons">arrow_back</i> back</a></div>
            <ArtworkRelatedContent id={id} links={this.props.data.relatedContent} />
            <ArtworkDetails art={art} />
          </div>

          <Sticky
            stickyStyle={{position: 'fixed', height: '100%', width: '65%', top: 0, transform: 'translate3d(0px,0px,0px)'}}
            onStickyStateChange={this.resizeMap}>
            <div ref='map' id='map' style={stickyMapStyle}>
              {this.state.zoomLoaded || art.image == 'valid' && <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', WebkitTransform: 'translate(-50%, -50%)'}}>
                {image}
                {art.image_copyright && <p style={{fontSize: '0.8em'}}>{decodeURIComponent(art.image_copyright)}</p>}
              </div>}
              {this.imageStatus()}
            </div>
          </Sticky>
          <Helmet
            title={pageTitle}
            meta={[
              {property: "og:title", content: pageTitle + ' ^ Minneapolis Institute of Art'},
              {property: "og:description", content: art.text},
              {property: "og:image", content: imageUrl},
              {property: "og:url", content: canonicalURL},
              {property: "twitter:card", content: "summary_large_image"},
              {property: "twitter:site", content: "@artsmia"},
            ]}
            link={[
              {"rel": "canonical", "href": canonicalURL},
            ]}
            />
        </div>
      )
    }


  },

  getInitialState() {
    var art = this.props.data.artwork
    art.id = this.props.id || art.id.replace('http://api.artsmia.org/objects/', '')

    return {
      art: art,
      id: art.id,
    }
  },

  componentDidMount() {
    var art = this.state.art
    if(art.image === 'valid' && art.restricted != 1) this.loadZoom()
  },

  loadZoom() {
    var L = require('museum-tile-layer')

    var art = this.state.art
    this.setState({zoomLoaded: false, zoomLoading: true})

    rest(`//tiles.dx.artsmia.org/${this.state.id}.json`)
    .then(
      response => JSON.parse(response.entity),
      rejected => Promise.reject(new Error(`can't load tiles for ${art.id}`))
    )
    .then((data) => {
      this.map = L.map(this.refs.map.getDOMNode(), {
        crs: L.CRS.Simple,
        zoomControl: false,
      })
      this.map.attributionControl.setPrefix('')
      this.map.setView([art.image_width/2, art.image_height/2], 0)
      if(!L.Browser.touch) new L.Control.Zoom({ position: 'topright' }).addTo(this.map)

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

    return art.image === 'valid' && <span className="imageStatus">
      {showLoadingMessage && loadingZoomMessage}
      {art.restricted === 1 && "Because of © restrictions, we can only show you a small image of this artwork. Sorry!" + copyrightAndOnViewMessage}
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
})
Artwork.contextTypes = {
  router: React.PropTypes.func,
  universal: React.PropTypes.bool,
}

module.exports = Artwork

