import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { SuperAdminComponent } from './super-admin.component';

describe('SuperAdminComponent', () => {
  let component: SuperAdminComponent;
  let fixture: ComponentFixture<SuperAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperAdminComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(SuperAdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
