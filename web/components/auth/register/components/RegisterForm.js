import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';
import ModernDatepicker from 'react-modern-datepicker';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { firebase } from '../../../../config/firebaseConfig';
import Login from '../../SocialLogins';
import s from '../../Auth.String';
import { SignupToCustomer, SignupToChef } from './Navigation';
import { toastMessage } from '../../../../utils/Toast';
import { StoreInLocal } from '../../../../utils/LocalStorage';
import Loader from '../../../Common/loader';
import * as gqlTag from '../../../../common/gql';
import { chef, customer, getCustomerAuthData, getChefAuthData } from '../../../../utils/UserType';
import { isStringEmpty, isNumberEmpty, isObjectEmpty } from '../../../../utils/checkEmptycondition';
import MobileNumberVerification from '../../../shared/mobile-number-verification/MobileNumberVerification';
import { logOutUser } from '../../../../utils/LogOut';
import { createApolloClient } from '../../../../apollo/apollo';

const updateAuthentication = gqlTag.mutation.auth.authtenticateGQLTAG;

const REGISTER_AUTH = gql`
  ${updateAuthentication}
`;

// Create apollo client
const apolloClient = createApolloClient();

export default function RegisterForm() {
  // In order to gain access to the child component instance,
  // you need to assign it to a `ref`, so we call `useRef()` to get one
  const childRef = useRef();
  // Declare a new state variable
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [icEye1, setIcEye1] = useState('fa fa-eye-slash');
  const [icEye2, setIcEye2] = useState('fa fa-eye-slash');
  const [passwordIcon1, setPasswordIcon1] = useState(true);
  const [passwordIcon2, setPasswordIcon2] = useState(true);
  const [loader, setLoader] = useState(false);
  const [chefUser, setChefUser] = useState(false);

  //mutation query

  const [registerAuthMutation, { data, loading,error }] = useMutation(REGISTER_AUTH, {
    onError: err => {
      console.log('gql response', err);
      logOutUser()
        .then(result => {})
        .catch(error => {
          toastMessage('renderError', error);
        });
      toastMessage('renderError', err.message);
    },
  });
  if(error){
    toastMessage('error',error)
  }

  useEffect(() => {
    try {
      setAuthData(data);
    } catch (error) {
      toastMessage('renderError', error.message);
    }
  }, [data]);

  async function checkMobileAndEmailDataExist(emailData, mobileData) {
    //Query for check mobile number exist or not
    let data = {
      pEmail: emailData ? emailData : '',
      pMobileNo: mobileData ? mobileData : '',
    };
    //get value form db
    const mobileValueCheckTag = gqlTag.query.auth.checkEmailAndMobileNoExistsGQLTAG;
    let output = await apolloClient
      .query({
        query: gql`
          ${mobileValueCheckTag}
        `,
        variables: data,
      })
      .then(result => {
        return true;
      })
      .catch(error => {
        toastMessage('renderError', error.message);
        return false;
      });
    return output;
  }

  async function setAuthData(data) {
    if (data !== undefined) {
      if (isObjectEmpty(data.authenticate) && isObjectEmpty(data.authenticate.data)) {
        //for customer login
        if (chefUser === false) {
          getCustomerAuthData(data.authenticate.data)
            .then(customerRes => {
              StoreInLocal('user_ids', customerRes);
              StoreInLocal('user_role', customer);
              toastMessage('success', 'Registered Successfully');
              SignupToCustomer();
            })
            .catch(error => {
              toastMessage('renderError', error.message);
            });
        }
        //for chef login
        else {
          getChefAuthData(data.authenticate.data)
            .then(chefRes => {
              StoreInLocal('user_ids', chefRes);
              StoreInLocal('user_role', chef);
              toastMessage('success', 'Registered Successfully');
              SignupToChef();
            })
            .catch(error => {
              toastMessage('renderError', error.message);
            });
        }
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    //Callback function from mobile number verification
    const mobileData = await childRef.current.getMobileNumberValue();

    const checkMobileNumberAndEmail = await checkMobileAndEmailDataExist(
      email,
      mobileData.mobileNumber
    );
    if (checkMobileNumberAndEmail === true) {
      // if (mobileData.mobileNumber === mobileData.mobileCallBackValue) {
      if (password === confirmPassword) {
        await signupAction(mobileData);
      } else {
        toastMessage('error', 'Password should match');
      }
      // } else {
      //   toastMessage('error', 'Please verify your phone number');
      // }
    }
  }

  //On submit
  function signupAction(mobileData) {
    try {
      setLoader(true);
      let userDetail = {
        firstname: firstName ? firstName : null,
        lastname: lastName ? lastName : null,
        dob: dob ? dob : null,
        mobileNumber: mobileData.mobileNumberValue ? mobileData.mobileNumberValue : null,
        countryCode: mobileData.countryCode ? mobileData.countryCode : null,
      };
      firebase
        .auth()
        .createUserWithEmailAndPassword(email, password)
        .then(user => {
          const currentUser = firebase.auth().currentUser;
          currentUser.getIdToken().then(data => {
            if (currentUser !== null && data) {
              let variables = {
                token: data,
                roleType: chefUser === true ? 'CHEF' : 'CUSTOMER',
                authenticateType: 'REGISTER',
                extra: JSON.stringify(userDetail),
              };
              // console.log('userDetail11', variables);
              registerAuthMutation({ variables });
              setLoader(false);
              StoreInLocal('current_user_token', data);
            } else {
              setLoader(false);
              toastMessage('error', 'The current user is not available');
            }
          });
        })
        .catch(error => {
          setLoader(false);
          const errorCode = error.code;
          const errorMessage = error.message;
          switch (errorCode) {
            case 'auth/invalid-email':
              // do something
              toastMessage('error', 'The email address is not valid');
              break;
            case 'auth/wrong-password':
              toastMessage('error', 'Wrong username or password');
              break;
            case 'auth/user-not-found':
              toastMessage('error', 'User not found');
              break;
            default:
              toastMessage('error', errorMessage);
            // handle other codes ...
          }
        });
    } catch (error) {
      toastMessage('renderError', error.message);
    }
  }

  //common setState function
  function onChangeValue(value, setState) {
    setState(value);
  }

  // Eye Icon visibility
  function changePwdType1() {
    if (passwordIcon1) {
      setIcEye1('fa fa-eye');
      setPasswordIcon1(false);
    } else {
      setIcEye1('fa fa-eye-slash');
      setPasswordIcon1(true);
    }
  }

  function changePwdType2() {
    if (passwordIcon2) {
      setIcEye2('fa fa-eye');
      setPasswordIcon2(false);
    } else {
      setIcEye2('fa fa-eye-slash');
      setPasswordIcon2(true);
    }
  }

  //loader
  function renderLoader() {
    if ((loading !== undefined && loading === true) || loader === true) {
      return (
        <div>
          <Loader />
        </div>
      );
    }
  }

  return (
    <React.Fragment>
      <section className="login-area ptb-60">
        <ToastContainer />
        <div className="container" id="register-content">
          <div className="">
            <div className="col-lg-12 col-md-12">
              <div className="login-content">
                <div className="section-title">
                  <h2>
                    <span className="dot"></span> Register
                  </h2>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>{s.FIRST_NAME}</label>
                    <input
                      type="text"
                      className={s.FORM_CONTROL}
                      placeholder={s.FIRST_NAME_PLACEHOLDER}
                      id="fname"
                      name="fname"
                      required
                      data-error="Please enter first name"
                      value={firstName}
                      onChange={event => onChangeValue(event.target.value, setFirstName)}
                    />
                  </div>

                  <div className="form-group">
                    <label>{s.LAST_NAME}</label>
                    <input
                      type="text"
                      className={s.FORM_CONTROL}
                      required
                      placeholder={s.LAST_NAME_PLACEHOLDER}
                      id="lname"
                      name="lname"
                      value={lastName}
                      onChange={event => onChangeValue(event.target.value, setLastName)}
                    />
                  </div>

                  <div className="form-group">
                    <label>{s.EMAIL}</label>
                    <input
                      type={s.EMAIL_INPUT}
                      className={s.FORM_CONTROL}
                      required
                      placeholder={s.EMAIL_PLACEHOLDER}
                      id={s.EMAIL_INPUT}
                      name={s.EMAIL_INPUT}
                      value={email}
                      onChange={event => onChangeValue(event.target.value, setEmail)}
                    />
                  </div>

                  {/* <div className="form-group">
                    <label>{s.DOB}</label>
                    <br />
                    <ModernDatepicker
                      date={dob}
                      format={'MM-DD-YYYY'}
                      showBorder
                      className={s.FORM_CONTROL}
                      maxDate={new Date()}
                      onChange={event => onChangeValue(event, setDob)}
                      placeholder={'Select a date'}
                      color={'#d9b44a'}
                    />
                  </div> */}

                  <div className="form-group">
                    <label>{s.PASSWORD}</label>
                    <div className="eyeIconView">
                      <input
                        type={passwordIcon1 ? s.PASSWORD_INPUT : s.TEXT}
                        required
                        minLength="6"
                        className={s.FORM_CONTROL}
                        placeholder={s.PASSWORD_PLACEHOLDER}
                        id={s.PASSWORD_INPUT}
                        name={s.PASSWORD_INPUT}
                        value={password}
                        onChange={event => onChangeValue(event.target.value, setPassword)}
                      />
                      <span>
                        <i className={icEye1} onClick={() => changePwdType1()}></i>
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{s.CONFIRM_PASSWORD}</label>
                    <div className="eyeIconView">
                      <input
                        type={passwordIcon2 ? s.PASSWORD_INPUT : s.TEXT}
                        required
                        minLength="6"
                        className={s.FORM_CONTROL}
                        placeholder={s.CONFIRM_PASSWORD_PLACEHOLDER}
                        name={s.PASSWORD_INPUT}
                        value={confirmPassword}
                        onChange={event => onChangeValue(event.target.value, setConfirmPassword)}
                      />
                      <i className={icEye2} onClick={() => changePwdType2()}></i>
                    </div>
                    <p>
                      <b>(password must contain at least 6 characters)</b>
                    </p>
                  </div>
                  <MobileNumberVerification ref={childRef} mobileNumber={mobileNumber} />
                  {/* <div className="login-keep">
                    <div className="buy-checkbox-btn">
                      <div className="item">
                        <input
                          className="inp-cbx"
                          id="userType"
                          type="checkbox"
                          checked={chefUser}
                          onChange={event => setChefUser(event.target.checked)}
                        />
                        <label className="cbx" htmlFor="userType">
                          <span>
                            <svg width="12px" height="10px" viewBox="0 0 12 10">
                              <polyline points="1.5 6 4.5 9 10.5 1"></polyline>
                            </svg>
                          </span>
                          <span>{s.ARE_YOU_CHEF}</span>
                        </label>
                      </div>
                    </div>
                  </div> */}
                  {renderLoader()}
                  <button type="submit" className="btn btn-primary">
                    Register
                  </button>
                </form>
              </div>
            </div>

            <div className="col-lg-12 col-md-12" id="socialLoginContainer">
              <p className="orFont">or</p>
            </div>

            <div className="col-lg-12 col-md-12" id="socialLoginContainer">
              <div>
                <Login
                  sourceType={'REGISTER'}
                  userType={chefUser === true ? 'CHEF' : 'CUSTOMER'}
                  checkMobileAndEmailDataExist={checkMobileAndEmailDataExist}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}