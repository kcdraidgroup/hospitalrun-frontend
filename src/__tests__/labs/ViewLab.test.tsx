import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import format from 'date-fns/format'
import { createMemoryHistory } from 'history'
import React from 'react'
import { Provider } from 'react-redux'
import { Router, Route } from 'react-router-dom'
import createMockStore from 'redux-mock-store'
import thunk from 'redux-thunk'

import * as validateUtil from '../../labs/utils/validate-lab'
import { LabError } from '../../labs/utils/validate-lab'
import ViewLab from '../../labs/ViewLab'
import * as ButtonBarProvider from '../../page-header/button-toolbar/ButtonBarProvider'
import * as titleUtil from '../../page-header/title/TitleContext'
import LabRepository from '../../shared/db/LabRepository'
import PatientRepository from '../../shared/db/PatientRepository'
import Lab from '../../shared/model/Lab'
import Patient from '../../shared/model/Patient'
import Permissions from '../../shared/model/Permissions'
import { RootState } from '../../shared/store'
import { expectOneConsoleError } from '../test-utils/console.utils'

const mockStore = createMockStore<RootState, any>([thunk])

describe('View Lab', () => {
  let history: any
  const mockPatient = { fullName: 'test' }
  const mockLab = {
    code: 'L-1234',
    id: '12456',
    status: 'requested',
    patient: '1234',
    type: 'lab type',
    notes: ['lab notes'],
    requestedOn: '2020-03-30T04:43:20.102Z',
  } as Lab

  let setButtonToolBarSpy: any
  let labRepositorySaveSpy: any
  const expectedDate = new Date()

  const setup = (lab: Lab, permissions: Permissions[], error = {}) => {
    jest.resetAllMocks()
    Date.now = jest.fn(() => expectedDate.valueOf())
    setButtonToolBarSpy = jest.fn()
    jest.spyOn(titleUtil, 'useUpdateTitle').mockImplementation(() => jest.fn())
    jest.spyOn(ButtonBarProvider, 'useButtonToolbarSetter').mockReturnValue(setButtonToolBarSpy)
    labRepositorySaveSpy = jest.spyOn(LabRepository, 'saveOrUpdate').mockResolvedValue(mockLab)
    jest.spyOn(PatientRepository, 'find').mockResolvedValue(mockPatient as Patient)
    jest.spyOn(LabRepository, 'find').mockResolvedValue(lab)

    history = createMemoryHistory()
    history.push(`labs/${lab.id}`)
    const store = mockStore({
      user: {
        permissions,
      },
      lab: {
        lab,
        patient: mockPatient,
        error,
        status: Object.keys(error).length > 0 ? 'error' : 'completed',
      },
    } as any)

    return render(
      <ButtonBarProvider.ButtonBarProvider>
        <Provider store={store}>
          <Router history={history}>
            <Route path="/labs/:id">
              <titleUtil.TitleProvider>
                <ViewLab />
              </titleUtil.TitleProvider>
            </Route>
          </Router>
        </Provider>
      </ButtonBarProvider.ButtonBarProvider>,
    )
  }

  describe('page content', () => {
    it("should display the patients' full name", async () => {
      const expectedLab = { ...mockLab } as Lab
      setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(screen.getByText('labs.lab.for')).toBeInTheDocument()
        expect(screen.getByText(mockPatient.fullName)).toBeInTheDocument()
      })
    })

    it('should display the lab-type', async () => {
      const expectedLab = { ...mockLab, type: 'expected type' } as Lab
      setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /labs.lab.type/i })).toBeInTheDocument()
        expect(screen.getByText(expectedLab.type)).toBeInTheDocument()
      })
    })

    it('should display the requested on date', async () => {
      const expectedLab = { ...mockLab, requestedOn: '2020-03-30T04:43:20.102Z' } as Lab
      setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(screen.getByText('labs.lab.requestedOn')).toBeInTheDocument()
        expect(
          screen.getByText(format(new Date(expectedLab.requestedOn), 'yyyy-MM-dd hh:mm a')),
        ).toBeInTheDocument()
      })
    })

    it('should not display the completed date if the lab is not completed', async () => {
      const expectedLab = { ...mockLab } as Lab
      const { container } = setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        // TODO: make sure it's not loading
        expect(container.querySelector('.completed-on')).not.toBeInTheDocument()
      })
    })

    it('should not display the canceled date if the lab is not canceled', async () => {
      const expectedLab = { ...mockLab } as Lab
      const { container } = setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(container.querySelector('.canceled-on')).not.toBeInTheDocument()
      })
    })

    it('should render a result text field', async () => {
      const expectedLab = {
        ...mockLab,
        result: 'expected results',
      } as Lab
      setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(
          screen.getByRole('textbox', {
            name: /labs\.lab\.result/i,
          }),
        ).toHaveValue(expectedLab.result)
      })
    })

    it('should display the past notes', async () => {
      const expectedNotes = 'expected notes'
      const expectedLab = { ...mockLab, notes: [expectedNotes] } as Lab
      const { container } = setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(screen.getByText(expectedNotes)).toBeInTheDocument()
        expect(container.querySelector('.callout')).toBeInTheDocument()
      })
    })

    it('should not display past notes if there is not', async () => {
      const expectedLab = { ...mockLab, notes: undefined } as Lab
      const { container } = setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        // TODO: make sure it's not loading
        expect(container.querySelector('.callout')).not.toBeInTheDocument()
      })
    })

    it('should display the notes text field empty', async () => {
      const expectedNotes = 'expected notes'
      const expectedLab = { ...mockLab, notes: [expectedNotes] } as Lab
      setup(expectedLab, [Permissions.ViewLab])

      await waitFor(() => {
        expect(screen.getByLabelText('labs.lab.notes')).toHaveValue('')
      })
    })

    it('should display errors', async () => {
      const expectedLab = { ...mockLab, status: 'requested' } as Lab
      setup(expectedLab, [Permissions.ViewLab, Permissions.CompleteLab])

      const expectedError = { message: 'some message', result: 'some result feedback' } as LabError
      expectOneConsoleError(expectedError)
      jest.spyOn(validateUtil, 'validateLabComplete').mockReturnValue(expectedError)

      await waitFor(() => {
        userEvent.click(
          screen.getByRole('button', {
            name: /labs\.requests\.complete/i,
          }),
        )
      })

      const alert = await screen.findByRole('alert')

      expect(alert).toContainElement(screen.getByText(/states\.error/i))
      expect(alert).toContainElement(screen.getByText(/some message/i))

      expect(screen.getByLabelText(/labs\.lab\.result/i)).toHaveClass('is-invalid')
    })

    describe('requested lab request', () => {
      it('should display a warning badge if the status is requested', async () => {
        const expectedLab = { ...mockLab, status: 'requested' } as Lab
        setup(expectedLab, [Permissions.ViewLab])

        await waitFor(() => {
          expect(
            screen.getByRole('heading', {
              name: /labs\.lab\.status/i,
            }),
          ).toBeInTheDocument()
          expect(screen.getByText(expectedLab.status)).toBeInTheDocument()
        })
      })

      it('should display a update lab, complete lab, and cancel lab button if the lab is in a requested state', async () => {
        setup(mockLab, [Permissions.ViewLab, Permissions.CompleteLab, Permissions.CancelLab])

        await waitFor(() => {
          screen.getByRole('button', {
            name: /actions\.update/i,
          })
          screen.getByRole('button', {
            name: /actions\.update/i,
          })
          screen.getByRole('button', {
            name: /actions\.update/i,
          })
        })
      })
    })

    describe('canceled lab request', () => {
      it('should display a danger badge if the status is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab
        setup(expectedLab, [Permissions.ViewLab])

        await waitFor(() => {
          expect(
            screen.getByRole('heading', {
              name: /labs\.lab\.status/i,
            }),
          ).toBeInTheDocument()
          expect(
            screen.getByRole('heading', {
              name: /canceled/i,
            }),
          ).toBeInTheDocument()
        })
      })

      it('should display the canceled on date if the lab request has been canceled', async () => {
        const expectedLab = {
          ...mockLab,
          status: 'canceled',
          canceledOn: '2020-03-30T04:45:20.102Z',
        } as Lab
        setup(expectedLab, [Permissions.ViewLab])

        await waitFor(() => {
          expect(
            screen.getByRole('heading', {
              name: /labs\.lab\.canceledon/i,
            }),
          ).toBeInTheDocument()
          expect(
            screen.getByRole('heading', {
              name: format(new Date(expectedLab.canceledOn as string), 'yyyy-MM-dd hh:mm a'),
            }),
          ).toBeInTheDocument()
        })
      })

      it('should not display update, complete, and cancel button if the lab is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab

        setup(expectedLab, [Permissions.ViewLab, Permissions.CompleteLab, Permissions.CancelLab])

        await waitFor(() => {
          expect(screen.queryByRole('button')).not.toBeInTheDocument()
        })
      })

      it('should not display notes text field if the status is canceled', async () => {
        const expectedLab = { ...mockLab, status: 'canceled' } as Lab

        setup(expectedLab, [Permissions.ViewLab])

        expect(screen.getByText('labs.lab.notes')).toBeInTheDocument()
        expect(screen.queryByLabelText('labs.lab.notes')).not.toBeInTheDocument()
      })
    })

    describe('completed lab request', () => {
      it('should display a primary badge if the status is completed', async () => {
        jest.resetAllMocks()
        const expectedLab = { ...mockLab, status: 'completed' } as Lab
        setup(expectedLab, [Permissions.ViewLab])

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'labs.lab.status' })).toBeInTheDocument()
          expect(screen.getByText(expectedLab.status)).toBeInTheDocument()
        })
      })

      it('should display the completed on date if the lab request has been completed', async () => {
        const expectedLab = {
          ...mockLab,
          status: 'completed',
          completedOn: '2020-03-30T04:44:20.102Z',
        } as Lab
        setup(expectedLab, [Permissions.ViewLab])

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'labs.lab.completedOn' })).toBeInTheDocument()
          expect(
            screen.getByText(
              format(new Date(expectedLab.completedOn as string), 'yyyy-MM-dd hh:mm a'),
            ),
          ).toBeInTheDocument()
        })
      })

      it('should not display update, complete, and cancel buttons if the lab is completed', async () => {
        const expectedLab = { ...mockLab, status: 'completed' } as Lab

        setup(expectedLab, [Permissions.ViewLab, Permissions.CompleteLab, Permissions.CancelLab])

        await waitFor(() => {
          expect(screen.queryByRole('button')).not.toBeInTheDocument()
        })
      })

      it('should not display notes text field if the status is completed', async () => {
        const expectedLab = { ...mockLab, status: 'completed' } as Lab

        setup(expectedLab, [Permissions.ViewLab, Permissions.CompleteLab, Permissions.CancelLab])

        expect(screen.getByText('labs.lab.notes')).toBeInTheDocument()
        expect(screen.queryByLabelText('labs.lab.notes')).not.toBeInTheDocument()
      })
    })
  })

  describe('on update', () => {
    it('should update the lab with the new information', async () => {
      setup(mockLab, [Permissions.ViewLab])
      const expectedResult = 'expected result'
      const newNotes = 'expected notes'

      const resultTextField = await screen.findByLabelText('labs.lab.result')

      userEvent.type(resultTextField, expectedResult)

      const notesTextField = screen.getByLabelText('labs.lab.notes')
      userEvent.type(notesTextField, newNotes)

      const updateButton = screen.getByRole('button', {
        name: 'actions.update',
      })
      userEvent.click(updateButton)

      const expectedNotes = mockLab.notes ? [...mockLab.notes, newNotes] : [newNotes]

      await waitFor(() => {
        expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
        expect(labRepositorySaveSpy).toHaveBeenCalledWith(
          expect.objectContaining({ ...mockLab, result: expectedResult, notes: expectedNotes }),
        )
        expect(history.location.pathname).toEqual('/labs/12456')
      })
    })
  })

  describe('on complete', () => {
    it('should mark the status as completed and fill in the completed date with the current time', async () => {
      setup(mockLab, [Permissions.ViewLab, Permissions.CompleteLab, Permissions.CancelLab])
      const expectedResult = 'expected result'

      const resultTextField = await screen.findByLabelText('labs.lab.result')

      userEvent.type(resultTextField, expectedResult)

      const completeButton = screen.getByRole('button', {
        name: 'labs.requests.complete',
      })

      userEvent.click(completeButton)

      await waitFor(() => {
        expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
        expect(labRepositorySaveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            ...mockLab,
            result: expectedResult,
            status: 'completed',
            completedOn: expectedDate.toISOString(),
          }),
        )
        expect(history.location.pathname).toEqual('/labs/12456')
      })
    })
  })

  describe('on cancel', () => {
    it('should mark the status as canceled and fill in the cancelled on date with the current time', async () => {
      setup(mockLab, [Permissions.ViewLab, Permissions.CompleteLab, Permissions.CancelLab])
      const expectedResult = 'expected result'

      const resultTextField = await screen.findByLabelText('labs.lab.result')

      userEvent.type(resultTextField, expectedResult)

      const completeButton = screen.getByRole('button', {
        name: 'labs.requests.cancel',
      })

      userEvent.click(completeButton)

      await waitFor(() => {
        expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
        expect(labRepositorySaveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            ...mockLab,
            result: expectedResult,
            status: 'canceled',
            canceledOn: expectedDate.toISOString(),
          }),
        )
        expect(history.location.pathname).toEqual('/labs')
      })
    })
  })
})
