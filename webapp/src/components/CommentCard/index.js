import React, { useEffect, useState, forwardRef } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { useTheme } from '@mui/material/styles'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import FilterListIcon from '@mui/icons-material/FilterList'
import Typography from '@mui/material/Typography'
import { makeStyles } from '@mui/styles'
import Snackbar from '@mui/material/Snackbar'
import MuiAlert from '@mui/material/Alert'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import MenuItem from '@mui/material//MenuItem'
import Menu from '@mui/material//Menu'
import Moment from 'react-moment'
import { useLazyQuery } from '@apollo/client'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import { Link as MLink } from '@mui/material'
import Button from '@mui/material/Button'
import CloseIcon from '@mui/icons-material/Close'

import { mainConfig } from '../../config'
import { useSharedState } from '../../context/state.context'
import { GET_COMMENTS } from '../../gql'

import styles from './styles'

const useStyles = makeStyles(styles)

const options = ['Latest Comments', 'Most Helpful']

const Alert = forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant='filled' {...props} />
})

const CommentCard = ({ producer = {} }) => {
  const { t } = useTranslation('comment')
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.only('xs'))
  const classes = useStyles()
  const [transactionId, setTransactionId] = useState('')
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const [showMessage, setShowMessage] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(1)
  const handleClick = event => {
    setAnchorEl(event.currentTarget)
  }
  const [state] = useSharedState()
  const [comments, setComments] = useState([])
  const [getData, { loading, data }] = useLazyQuery(GET_COMMENTS, {
    fetchPolicy: 'network-only'
  })
  const blockProducer = _get(producer, 'system.owner', null)

  useEffect(() => {
    if (loading || !data) return

    const { comment } = data
    const commentList = comment.map(comment => {
      return { ...comment }
    })
    setComments([...commentList])
  }, [data, loading])

  useEffect(() => {
    const getDataAsync = async () => {
      await getData({
        variables: { bp: blockProducer }
      })
    }

    if (!data) {
      getDataAsync(blockProducer)
    }
  }, [blockProducer])

  const handleLike = (ratinId, like) => {
    sendLike(ratinId, like)
  }

  const handleCloseMessage = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }

    setShowMessage(false)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }
  const handleMenuItemClick = index => {
    setSelectedIndex(index)
    setAnchorEl(null)

    if (index === 0) {
      comments.sort(
        (a, b) =>
          new Date(...b.created_at.split('/').reverse()) -
          new Date(...a.created_at.split('/').reverse())
      )
    }

    if (index === 1) {
      comments.sort((a, b) => (a.total_like < b.total_like ? 1 : -1))
    }
  }
  useEffect(() => {
    handleMenuItemClick(onloadstart, 0)
  }, [])

  const sendLike = async (id, like) => {
    try {
      if (!state.user?.accountName) {
        return
      }
      const transaction = {
        actions: [
          {
            authorization: [
              {
                actor: state.user?.accountName,
                permission: 'active'
              }
            ],
            account: mainConfig.contract,
            name: 'loglike',
            data: {
              rating_id: id,
              user: state.user?.accountName,
              like
            }
          }
        ]
      }
      const result = await state.ual.activeUser.signTransaction(transaction, {
        broadcast: true
      })

      setTransactionId(result.transaction.transaction_id)
      setShowMessage(true)
    } catch (error) {
      console.warn(error)
    }
  }

  return (
    <Grid pt={6} container justifyContent='center' md={12}>
      <Grid className={classes.sectionContent} item md={12} xs={12}>
        <Box className={classes.cardContainer}>
          <Box display='flex' justifyContent='end' alignItems='center'>
            <Typography flex={1} mt='28px' mb='44px' variant='h6'>
              {t('userComments')} ({comments.length})
            </Typography>
            <IconButton
              onClick={handleClick}
              aria-controls={open ? 'account-menu' : undefined}
              aria-haspopup='true'
              aria-expanded={open ? 'true' : undefined}
              className={classes.btnFilter}
            >
              <FilterListIcon />
              <Typography
                textTransform='uppercase'
                marginLeft={1}
                variant='body2'
              >
                {options[selectedIndex]}
              </Typography>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              id='account-menu'
              open={open}
              onClose={handleClose}
              onClick={handleClose}
            >
              {options.map((option, index) => (
                <MenuItem
                  key={option}
                  selected={index === selectedIndex}
                  onClick={() => handleMenuItemClick(index)}
                >
                  <Typography variant='body3' textTransform='uppercase'>
                    {option}
                  </Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <Box pl={2}>
            {comments.map((comment, index) => (
              <Box pt='12px' pb='12px' key={index}>
                <Box display='flex'>
                  <Typography variant='body2' display='flex' flex={1} mb={2}>
                    {comment.user}
                  </Typography>
                  <Typography
                    variant='body2'
                    display='flex'
                    flex={1}
                    mb={2}
                    justifyContent='end'
                  >
                    <Moment fromNow>{comment.created_at}</Moment>
                  </Typography>
                </Box>
                <Typography>{comment.content}</Typography>
                <Grid container>
                  <Grid item md={8} className={classes.center}>
                    <Box pt={1} display={isMobile ? 'block' : 'flex'}>
                      {Object.entries(comment.user_ratings[0].ratings).map(
                        (param, index) => (
                          <Box key={index}>
                            <Box
                              width={isMobile ? '90px' : 'auto'}
                              display='inline-block'
                            >
                              <Typography
                                variant='body3'
                                textTransform='capitalize'
                                mr={1}
                              >
                                {param[0]}:
                              </Typography>
                            </Box>
                            <Typography variant='body4' mr={2}>
                              {param[1]}
                            </Typography>
                          </Box>
                        )
                      )}
                    </Box>
                  </Grid>
                  <Grid item md={4} className={classes.box}>
                    <Box pt={1}>
                      <Typography
                        variant='body3'
                        textTransform='uppercase'
                        mr={1}
                      >
                        {t('isThisHelpful')}
                      </Typography>
                      <Typography variant='body3' className={classes.likeNum}>
                        {comment.total_like}
                        <IconButton
                          onClick={() => handleLike(comment.rating_id, true)}
                        >
                          <ThumbUpIcon className={classes.thumb} />
                        </IconButton>
                      </Typography>
                      <Typography
                        variant='body3'
                        className={classes.dislikeNum}
                      >
                        {comment.total_dislike}
                        <IconButton
                          onClick={() => handleLike(comment.rating_id, false)}
                        >
                          <ThumbDownIcon className={classes.thumb} />
                        </IconButton>
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Box>
        </Box>
      </Grid>
      <Snackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        className={classes.snackbar}
        open={showMessage}
        autoHideDuration={6000}
        onClose={handleCloseMessage}
        action={
          <Alert severity='success'>
            <Button
              color='secondary'
              size='small'
              className={classes.messageBtn}
            >
              <MLink
                rel='noopener'
                target='_blank'
                className={classes.linkText}
                href={`${mainConfig.blockExplorer}/transaction/${transactionId}`}
              >
                {`${t('interactionComment')}, ${(transactionId || '').slice(
                  0,
                  8
                )}`}
              </MLink>
            </Button>
            <IconButton
              aria-label='close'
              color='inherit'
              onClick={handleCloseMessage}
            >
              <CloseIcon />
            </IconButton>
          </Alert>
        }
      />
    </Grid>
  )
}

CommentCard.propTypes = {
  producer: PropTypes.oneOfType([PropTypes.object, PropTypes.bool])
}
export default CommentCard
